require('dotenv').config();
const express = require('express');
const db = require('./db');
const initializeTables = require('./utils/initDb');
const MatchProcessor = require('./services/matchProcessor');
const {
  logServiceStart,
  logServiceStarted,
  logDatabaseConnection,
  logInitialAccountCount,
  logLoopStart,
  logLoopEnd,
  logLoopSummary,
  logWaitingForNextLoop,
  logLoopProgress,
  logGeneralError,
  logWaitingForRetry,
  logShutdown,
  logApiKeyMissing
} = require('./debugger/matchFinder');
const { logServerStart, logServerStarted, logLogsLevel } = require('./debugger/server');

// Configuration
const API_KEY = process.env.API_KEY;
const LOOP_INTERVAL_SECONDS = parseInt(process.env.ACCOUNTS_FINDER_INTERVAL_SECONDS || '3600'); // Default: 1 hour
const MATCHES_PER_ACCOUNT = parseInt(process.env.MATCHES_PER_ACCOUNT || '100'); // Default: 100 matches per account
const VIP_SYNC_INTERVAL_HOURS = parseInt(process.env.VIP_SYNC_INTERVAL_HOURS || '12');
const VIP_MATCHES_PER_ACCOUNT = parseInt(process.env.VIP_MATCHES_PER_ACCOUNT || '50');
const PROGRESS_LOG_INTERVAL = parseInt(process.env.PROGRESS_LOG_INTERVAL || '50'); // Progress log every N accounts

if (!API_KEY) {
  logApiKeyMissing();
  process.exit(1);
}

// Initialize Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'accounts-finder',
    version: '1.0.0'
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  // Get current rate limiter status from the match processor
  const rateLimiterStatus = matchProcessor.api?.rateLimiter?.getStatus() || {};
  const globalStatus = rateLimiterStatus.global || {};
  const matchIdsStatus = rateLimiterStatus.getMatchIds || {};
  const matchDetailsStatus = rateLimiterStatus.getMatchDetails || {};
  const accountInfoStatus = rateLimiterStatus.getAccountInfo || {};
  
  const metrics = {
    // System metrics
    accounts_finder_up: 1,
    accounts_finder_start_time: process.uptime(),
    
    // Business metrics
    accounts_finder_new_accounts_total: global.newAccountsFound || 0,
    accounts_finder_matches_processed_total: global.matchesProcessed || 0,
    accounts_finder_duplicates_found_total: global.duplicatesFound || 0,
    accounts_finder_accounts_processed_total: global.accountsProcessed || 0,
    
    // Rate Limiter metrics - Global
    accounts_finder_rate_limit_remaining: globalStatus.remaining || 0,
    accounts_finder_rate_limit_errors_total: global.rateLimitErrors || 0,
    accounts_finder_rate_limit_max_requests: globalStatus.limit || 6000,
    accounts_finder_rate_limit_current_requests: globalStatus.current || 0,
    accounts_finder_rate_limit_window_seconds: 10,
    
    // Rate Limiter metrics - Match IDs endpoint
    accounts_finder_match_ids_remaining: matchIdsStatus.remaining || 0,
    accounts_finder_match_ids_current: matchIdsStatus.current || 0,
    accounts_finder_match_ids_limit: matchIdsStatus.limit || 2000,
    
    // Rate Limiter metrics - Match Details endpoint
    accounts_finder_match_details_remaining: matchDetailsStatus.remaining || 0,
    accounts_finder_match_details_current: matchDetailsStatus.current || 0,
    accounts_finder_match_details_limit: matchDetailsStatus.limit || 2000,
    
    // Rate Limiter metrics - Account Info endpoint
    accounts_finder_account_info_remaining: accountInfoStatus.remaining || 0,
    accounts_finder_account_info_current: accountInfoStatus.current || 0,
    accounts_finder_account_info_limit: accountInfoStatus.limit || 20000,
    
    // Batch Processing metrics
    accounts_finder_batch_size: global.currentBatchSize || 1,
    accounts_finder_batch_size_min: 1,
    accounts_finder_batch_size_max: 5,
    accounts_finder_concurrent_batches: global.concurrentBatches || 1,
    accounts_finder_concurrent_batches_max: 2,
    accounts_finder_total_concurrency: (global.currentBatchSize || 1) * (global.concurrentBatches || 1),
    accounts_finder_total_concurrency_max: 10,
    
    // Adaptive Backoff metrics
    accounts_finder_backoff_min_delay_seconds: 10,
    accounts_finder_backoff_max_delay_seconds: 480,
    accounts_finder_backoff_current_delay_seconds: global.currentBackoffDelay || 10,
    accounts_finder_backoff_retry_count: global.backoffRetryCount || 0,
    accounts_finder_backoff_max_retries: 5,
    
    // Memory Management metrics
    accounts_finder_memory_usage_bytes: process.memoryUsage().heapUsed,
    accounts_finder_memory_total_bytes: process.memoryUsage().heapTotal,
    accounts_finder_memory_usage_percent: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
    accounts_finder_memory_threshold_percent: 80,
    accounts_finder_memory_check_interval_minutes: 5,
    accounts_finder_gc_frequency_accounts: 50,
    accounts_finder_cache_size_entries: 500,
    
    // Progress Logging metrics
    accounts_finder_log_frequency_accounts: 10,
    accounts_finder_sync_timeout_hours: 24,
    accounts_finder_recovery_delay_seconds: 30,
    
    // Graceful Shutdown metrics
    accounts_finder_shutdown_timeout_seconds: 30,
    accounts_finder_db_pool_max_connections: 20,
    accounts_finder_db_connection_timeout_seconds: 30,
    
    // Error metrics
    accounts_finder_errors_total: global.totalErrors || 0,
    accounts_finder_429_errors_total: global.error429Count || 0,
    accounts_finder_504_errors_total: global.error504Count || 0,
    
    // Performance metrics
    accounts_finder_processing_rate_accounts_per_minute: global.processingRate || 0,
    accounts_finder_avg_processing_time_seconds: global.avgProcessingTime || 0,
    accounts_finder_success_rate_percent: global.successRate || 100,
    
    // Match processing metrics
    accounts_finder_matches_per_account: MATCHES_PER_ACCOUNT,
    accounts_finder_progress_log_interval: PROGRESS_LOG_INTERVAL,
    accounts_finder_loop_interval_seconds: LOOP_INTERVAL_SECONDS,

    // VIP loop metrics
    accounts_finder_vip_loops_total: global.vipLoops || 0,
    accounts_finder_vip_accounts_processed_total: global.vipAccountsProcessed || 0,
    accounts_finder_vip_matches_processed_total: global.vipMatchesProcessed || 0,
    accounts_finder_vip_loop_duration_seconds: global.vipLoopDurationSeconds || 0,
    accounts_finder_vip_sync_interval_hours: VIP_SYNC_INTERVAL_HOURS,
    accounts_finder_vip_matches_per_account: VIP_MATCHES_PER_ACCOUNT
  };

  // Format as Prometheus metrics
  const prometheusMetrics = Object.entries(metrics)
    .map(([key, value]) => `${key} ${value}`)
    .join('\n');

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

// Force refresh PlayedWith for a specific account
app.post('/api/force-played-with', async (req, res) => {
  try {
    const { region, nickname, tag, matches } = req.body || {};
    if (!region || !nickname || !tag) {
      return res.status(400).json({ error: 'Missing region, nickname or tag' });
    }
    // Find account
    const { rows } = await db.query(
      'SELECT id, region, nickname, tag, puuid, continent FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3',
      [region, nickname, tag]
    );
    const account = rows[0];
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const matchesPerAccount = parseInt(matches || VIP_MATCHES_PER_ACCOUNT || 50);
    const result = await matchProcessor.processAccount(account, matchesPerAccount, 1);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Initialize global metrics
global.newAccountsFound = 0;
global.matchesProcessed = 0;
global.duplicatesFound = 0;
global.accountsProcessed = 0;
global.rateLimitRemaining = 0;
global.rateLimitErrors = 0;
global.currentRateLimit = 10000;
global.currentBatchSize = 1;
global.concurrentBatches = 1;
global.currentBackoffDelay = 10;
global.backoffRetryCount = 0;
global.totalErrors = 0;
global.error429Count = 0;
global.error504Count = 0;
global.processingRate = 0;
global.avgProcessingTime = 0;
global.successRate = 100;

// Initialize services
const matchProcessor = new MatchProcessor(API_KEY);

/**
 * Main loop function
 */
async function runLoop(loopNumber) {
  try {
    logLoopStart(loopNumber);
    
    // Get total accounts before processing
    const { rows: totalAccounts } = await db.query('SELECT COUNT(*) as count FROM AccountsToSync');
    const totalCount = totalAccounts[0].count;
    
    logLoopProgress(loopNumber, totalCount);
    
    // Process all accounts to find new players
    const result = await matchProcessor.processAllAccounts(MATCHES_PER_ACCOUNT, PROGRESS_LOG_INTERVAL);
    
    logLoopEnd(loopNumber, result.uniqueFound, result.duplicates, totalCount);
    logLoopSummary(result.uniqueFound, result.duplicates, result.totalProcessed);
    
    return result;
  } catch (error) {
    logGeneralError(`loop #${loopNumber}`, error);
    return { uniqueFound: 0, duplicates: 0, totalProcessed: 0 };
  }
}

/**
 * Main service function
 */
async function startService() {
  logServiceStart();
  
  try {
    // Initialize database tables
    await initializeTables();
    
    // Test database connection
    await db.query('SELECT 1');
    logDatabaseConnection();
    
    // Start HTTP server for health checks and metrics
    const port = process.env.PORT || 3002;
    app.listen(port, () => {
      logServerStart(port);
      logLogsLevel(process.env.LOGS_LEVEL);
    });
    
    // Get initial account count
    const { rows: initialCount } = await db.query('SELECT COUNT(*) as count FROM AccountsToSync');
    logInitialAccountCount(initialCount[0].count);
    
    logServiceStarted();
    
    let loopNumber = 1;
    let vipLoopNumber = 1;
    
    // Main service loop
    while (true) {
      try {
        await runLoop(loopNumber);
        
        // Wait before next loop
        logWaitingForNextLoop(LOOP_INTERVAL_SECONDS);
        await new Promise(resolve => setTimeout(resolve, LOOP_INTERVAL_SECONDS * 1000));
        
        loopNumber++;
      } catch (error) {
        logGeneralError('main service loop', error);
        
        // Wait a bit before retrying
        logWaitingForRetry();
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }
  } catch (error) {
    logGeneralError('service startup', error);
    process.exit(1);
  }
}

// VIP loop (runs independently on a timer)
async function runVipLoop(loopNumber) {
  const start = Date.now();
  try {
    const { rows: vipAccounts } = await db.query(
      'SELECT id, region, nickname, tag, puuid, continent FROM AccountsToSync WHERE vip = TRUE'
    );
    let vipAccountsProcessed = 0;
    let vipMatchesProcessedBefore = global.matchesProcessed || 0;

    for (const account of vipAccounts) {
      try {
        await matchProcessor.processAccount(account, VIP_MATCHES_PER_ACCOUNT, vipAccounts.length);
        vipAccountsProcessed++;
      } catch (_) {}
    }

    const vipMatchesProcessed = (global.matchesProcessed || 0) - vipMatchesProcessedBefore;
    global.vipLoops = (global.vipLoops || 0) + 1;
    global.vipAccountsProcessed = (global.vipAccountsProcessed || 0) + vipAccountsProcessed;
    global.vipMatchesProcessed = (global.vipMatchesProcessed || 0) + vipMatchesProcessed;
    global.vipLoopDurationSeconds = (Date.now() - start) / 1000;
  } catch (e) {
    // ignore
  }
}

// Schedule VIP loop
setTimeout(() => {
  const intervalMs = Math.max(1, VIP_SYNC_INTERVAL_HOURS) * 60 * 60 * 1000;
  runVipLoop(1).finally(() => {
    setInterval(() => runVipLoop(1), intervalMs);
  });
}, 15000);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logShutdown();
  await db.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logShutdown();
  await db.end();
  process.exit(0);
});

// Start the service
startService().catch(error => {
  logGeneralError('service startup', error);
  process.exit(1);
}); 