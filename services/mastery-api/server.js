const express = require('express');
const dotenv = require('dotenv');
const updateChampions = require('./services/updateChampions');
const initializeTables = require("./utils/initDb");
const DataSync = require('./services/dataSync');
const MemoryMonitor = require('./utils/memoryMonitor');
const { healthCheck, metrics } = require('./routes/healthRoutes');
const db = require('./db');
const ApiRoutes = require('./routes/apiRoutes');
const ProcessManager = require('./utils/processManager');
const SyncScheduler = require('./utils/syncScheduler');
const { logVipStart, logVipProgress, logVipComplete } = require('./debugger/vip');
const { 
  logServerStart, 
  logLogsLevel, 
  logServicesRunning 
} = require('./debugger/server');
const { setDataSync, setScheduler } = require('./utils/globalState');
const { logServerStartupError } = require('./debugger/processManager');

dotenv.config();

// Set default LOGS_LEVEL if not defined
if (!process.env.LOGS_LEVEL) {
  process.env.LOGS_LEVEL = '0';
}

// Performance optimization settings
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '2');
const MAX_CONCURRENT_BATCHES = parseInt(process.env.MAX_CONCURRENT_BATCHES || '1');
const RATE_LIMIT_LOG_INTERVAL = parseInt(process.env.RATE_LIMIT_LOG_INTERVAL || '5000');

const app = express();
app.use(express.json());

// Initialize utility modules
const memoryMonitor = new MemoryMonitor();
const config = {
  batchSize: BATCH_SIZE,
  maxConcurrentBatches: MAX_CONCURRENT_BATCHES,
  syncMode: 'continuous'
};

// Initialize routes
const apiRoutes = new ApiRoutes(process.env.API_KEY);

// Register routes
app.get('/health', healthCheck);
app.get('/metrics', metrics);
apiRoutes.registerRoutes(app);

const port = process.env.PORT || 8080;
const VIP_SYNC_INTERVAL_HOURS = parseInt(process.env.VIP_SYNC_INTERVAL_HOURS || '12');

// Global sync instance for monitoring
let globalSync = null;

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    // Initialize database tables
    await initializeTables();
    
    // Start server
    app.listen(port, () => {
      logServerStart(port);
      logLogsLevel(process.env.LOGS_LEVEL);
    });

    // Initialize services
    logServicesRunning();
    
    // Update champions data
    await updateChampions();
    
    // Start data synchronization with optimized settings
    globalSync = new DataSync(process.env.API_KEY);
    setDataSync(globalSync);
    
    // Configure batch processing settings
    globalSync.batchSize = BATCH_SIZE;
    globalSync.maxConcurrentBatches = MAX_CONCURRENT_BATCHES;
    
    // Configure rate limiting log throttling
    if (globalSync.api) {
      globalSync.api.rateLimitLogThrottle = RATE_LIMIT_LOG_INTERVAL;
    }
    
    // Start memory monitoring
    memoryMonitor.start();
    
    // Initialize process manager
    const processManager = new ProcessManager(memoryMonitor, null);
    processManager.setupEventHandlers();
    
    // Start continuous sync scheduler
    const syncScheduler = new SyncScheduler(globalSync);
    syncScheduler.schedule(); // Start continuous mode
    setScheduler(syncScheduler);
    
    // Store sync scheduler reference for graceful shutdown
    processManager.updateSyncScheduler(syncScheduler);
    
    // Initialize global metrics
    global.accountsProcessed = 0;
    global.newEntries = 0;
    global.failedAccounts = 0;
    global.lastSyncDuration = 0;
    global.rateLimitRemaining = 0;
    global.rateLimitErrors = 0;
    global.currentBatchSize = BATCH_SIZE;
    global.concurrentBatches = MAX_CONCURRENT_BATCHES;
    global.totalErrors = 0;
    global.error429Count = 0;
    global.error504Count = 0;
    // VIP metrics defaults
    global.m_api_vip_sync_runs_total = 0;
    global.m_api_vip_accounts_processed_total = 0;
    global.m_api_vip_sync_duration_seconds = 0;
    global.m_api_vip_last_total_accounts = 0;
    global.m_api_vip_last_processed = 0;
    global.m_api_vip_last_failed = 0;
    global.m_api_vip_progress_percent = 0;

    // VIP sync scheduler (priority refresh of VIP accounts)
    async function runVipSync() {
      const started = Date.now();
      try {
        const { rows: vipAccounts } = await db.query(
          `SELECT region, nickname, tag, puuid 
           FROM AccountsToSync 
           WHERE vip = TRUE 
             AND (lastupdated_mastery IS NULL OR lastupdated_mastery < NOW() - INTERVAL '2 hours')`
        );
        const total = vipAccounts.length || 0;
        let processed = 0;
        let failed = 0;

        // init last-run metrics
        global.m_api_vip_last_total_accounts = total;
        global.m_api_vip_last_processed = 0;
        global.m_api_vip_last_failed = 0;
        global.m_api_vip_progress_percent = 0;

        logVipStart(total);

        // signal priority: pause normal sync while VIP is running
        global.vipInProgress = true;

        for (const acc of vipAccounts) {
          try {
            await globalSync.syncChampionMastery(acc.region, acc.puuid, acc.nickname, acc.tag, true);
            processed++;
          } catch (_) {
            failed++;
          }

          // update progress metrics
          global.m_api_vip_last_processed = processed;
          global.m_api_vip_last_failed = failed;
          global.m_api_vip_progress_percent = total > 0 ? Math.round((processed / total) * 100) : 100;

          // periodic progress logs (every 10 accounts or on completion)
          const elapsedMinutes = (Date.now() - started) / 60000;
          const remainingAccounts = Math.max(0, total - processed);
          const estimatedRemainingMinutes = processed > 0 ? (elapsedMinutes / processed) * remainingAccounts : 0;
          if (processed % 10 === 0 || processed === total) {
            logVipProgress(processed, total, elapsedMinutes, estimatedRemainingMinutes, failed);
          }
        }
        global.m_api_vip_sync_runs_total = (global.m_api_vip_sync_runs_total || 0) + 1;
        global.m_api_vip_accounts_processed_total = (global.m_api_vip_accounts_processed_total || 0) + processed;
        global.m_api_vip_sync_duration_seconds = (Date.now() - started) / 1000;
        logVipComplete(processed, total, global.m_api_vip_sync_duration_seconds, failed);
      } catch (_) {
        // ignore errors to avoid crashing scheduler
      } finally {
        global.vipInProgress = false;
      }
    }

    // Kick off VIP scheduler
    const intervalMs = Math.max(1, VIP_SYNC_INTERVAL_HOURS) * 60 * 60 * 1000;
    setTimeout(() => {
      runVipSync();
      setInterval(runVipSync, intervalMs);
    }, 10000);
    
  } catch (error) {
    logServerStartupError(error);
    process.exit(1);
  }
}

// Start the application
initializeApp();