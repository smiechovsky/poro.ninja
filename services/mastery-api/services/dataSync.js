const RiotApi = require('./riotApi');
const { regionToContinent } = require('../utils/regionMapper');
const UserCache = require('../utils/userCache');
const MasteryDataManager = require('../utils/masteryDataManager');
const BatchProcessor = require('../utils/batchProcessor');
const BatchSizeManager = require('../utils/batchSizeManager');
const ProgressLogger = require('../utils/progressLogger');
const SyncScheduler = require('../utils/syncScheduler');
const { 
  logSchedulerStart, 
  logSchedulerComplete, 
  logSyncErrors,
  logSkippedAccounts,
  logSyncAllAccountsError
} = require('../debugger/scheduler');
const { logSyncError } = require('../debugger/scheduler');
const { 
  logUnexpectedTimeout, 
  logLegacyScheduleMethod 
} = require('../debugger/scheduler');

class DataSync {
  constructor(apiKey) {
    this.api = new RiotApi(apiKey);
    this.startTime = Date.now();
    this.processedAccounts = 0;
    this.totalNewEntries = 0;
    this.failedCount = 0;
    
    // Initialize utility modules
    this.userCache = new UserCache(500);
    this.batchProcessor = new BatchProcessor(this);
    this.batchSizeManager = new BatchSizeManager(this);
    this.progressLogger = new ProgressLogger(this);
    this.syncScheduler = new SyncScheduler(this);
    
    // Batch processing configuration - adaptive based on errors
    this.batchSize = 2; // Start with smaller batch size
    this.maxConcurrentBatches = 1; // Reduced from 2 to 1 for better stability
    this.adaptiveBatchSize = true;
    this.errorCount = 0;
    this.lastErrorReset = Date.now();
  }

  /**
   * Sync champion mastery for a single account
   */
  async syncChampionMastery(region, puuid, nickname, tag, priority = false) {
    try {
      // Champion mastery uses region, not continent
      const masteryData = await this.api.fetchChampionMastery(region, puuid, priority);
      
      if (!masteryData || masteryData.length === 0) {
        await MasteryDataManager.updateLastUpdated(puuid);
        return 0;
      }

      // Get user_id from cache or database
      const userId = await this.userCache.getUserId(puuid);
      if (!userId) {
        return 0;
      }

      // Batch insert mastery data
      const newEntries = await MasteryDataManager.batchInsertMasteryData(userId, masteryData);
      
      // Update lastupdated_mastery timestamp after successful sync
      await MasteryDataManager.updateLastUpdated(puuid);
      
      return newEntries;
    } catch (error) {
      logSyncError(region, puuid, error);
      throw error;
    }
  }

  /**
   * Main sync method for all accounts
   */
  async syncAllAccounts() {
    this.resetSyncState();
    
    try {
      const syncTimeout = this.setupSyncTimeout();
      
      try {
        const { accounts, totalCount } = await MasteryDataManager.getAccountsToSync();
        const skippedCount = totalCount - accounts.length;
        
        logSkippedAccounts(skippedCount, totalCount);
        logSchedulerStart(accounts.length);
        
        await this.processAllAccounts(accounts);
        
        const durationMs = Date.now() - this.startTime;
        const elapsedMinutes = durationMs / 60000;
        
        // Final summary
        this.progressLogger.logFinalSummary(elapsedMinutes, accounts.length);
        
        logSchedulerComplete(this.processedAccounts, accounts.length, this.totalNewEntries, durationMs);
        
        if (this.failedCount > 0) {
          logSyncErrors(this.failedCount, accounts.length);
        }
        
        clearTimeout(syncTimeout);
        return { processedCount: this.processedAccounts, totalNewEntries: this.totalNewEntries, durationMs, errorCount: this.failedCount };
      } catch (error) {
        clearTimeout(syncTimeout);
        throw error;
      }
    } catch (error) {
      logSyncAllAccountsError(error);
      const durationMs = Date.now() - this.startTime;
      logSchedulerComplete(0, 0, 0, durationMs);
      return { processedCount: 0, totalNewEntries: 0, durationMs, errorCount: 1 };
    }
  }

  /**
   * Reset sync state for new run
   */
  resetSyncState() {
    this.startTime = Date.now();
    this.processedAccounts = 0;
    this.totalNewEntries = 0;
    this.failedCount = 0;
    this.errorCount = 0;
    this.lastErrorReset = Date.now();
    this.userCache.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Setup sync timeout (disabled in continuous mode)
   */
  setupSyncTimeout() {
    // In continuous mode, we don't want timeouts that crash the service
    // Return a dummy timeout that never fires
    return setTimeout(() => {
      // This should never be called in continuous mode
      logUnexpectedTimeout();
    }, 24 * 60 * 60 * 1000); // 24 hours - effectively disabled
  }

  /**
   * Process all accounts in batches
   */
  async processAllAccounts(accounts) {
    for (let i = 0; i < accounts.length; i += this.batchSize * this.maxConcurrentBatches) {
      const batchPromises = [];
      
      // Create multiple batches to run in parallel
      for (let j = 0; j < this.maxConcurrentBatches && i + j * this.batchSize < accounts.length; j++) {
        const batchStart = i + j * this.batchSize;
        const batchEnd = Math.min(batchStart + this.batchSize, accounts.length);
        const batch = accounts.slice(batchStart, batchEnd);
        
        batchPromises.push(this.batchProcessor.processBatch(batch));
      }
      
      // Wait for all batches in this round to complete
      await Promise.all(batchPromises);

      // Adjust batch size based on error rate
      this.batchSizeManager.adjustBatchSize();

      // Log progress and perform garbage collection
      if (this.progressLogger.shouldLogProgress()) {
        this.progressLogger.logCurrentProgress(accounts.length);
        
        if (this.progressLogger.shouldPerformGC()) {
          global.gc();
        }
      }
    }
  }

  /**
   * Schedule periodic sync (legacy - not used in continuous mode)
   */
  schedule(interval) {
    // In continuous mode, this method is not used
    // The scheduler is managed directly by SyncScheduler
          logLegacyScheduleMethod();
    this.syncScheduler.schedule();
  }

  /**
   * Get region to continent mapping
   */
  regionToContinent(region) {
    return regionToContinent(region);
  }
}

module.exports = DataSync;