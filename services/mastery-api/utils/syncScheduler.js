const { 
  logSchedulerError,
  logPreviousSyncRunning,
  logContinuousSyncStarted,
  logContinuousSyncCompleted,
  logContinuousSyncError,
  logContinuousSyncModeEnabled,
  logSyncSchedulingError,
  logScheduledSyncStarted,
  logScheduledSyncCompleted,
  logScheduledSyncError,
  logMemoryUsage,
  logContinuousSyncStopped
} = require('../debugger/scheduler');

/**
 * Handles sync scheduling and execution
 */
class SyncScheduler {
  constructor(dataSync) {
    this.dataSync = dataSync;
    this.isRunning = false;
    this.syncIntervalId = null;
  }

  /**
   * Schedule continuous sync (no fixed intervals)
   */
  schedule() {
    const runContinuousSync = async () => {
      if (this.isRunning) {
        logPreviousSyncRunning();
        return;
      }

      this.isRunning = true;
      
      try {
        logContinuousSyncStarted();
        // Defer normal sync while VIP queue is in progress
        if (global.vipInProgress) {
          this.isRunning = false;
          setTimeout(() => runContinuousSync(), 2000);
          return;
        }
        await this.dataSync.syncAllAccounts();
        logContinuousSyncCompleted();
        
        // Schedule next sync after a short delay (5 seconds)
        setTimeout(() => {
          this.isRunning = false;
          runContinuousSync();
        }, 5000);
        
      } catch (error) {
        logContinuousSyncError(error.message);
        this.handleSyncError(error);
        
        // Retry after 30 seconds on error
        setTimeout(() => {
          this.isRunning = false;
          runContinuousSync();
        }, 30000);
      }
    };

    // Start continuous sync
    runContinuousSync();
    
    logContinuousSyncModeEnabled();
  }

  /**
   * Handle sync errors
   */
  handleSyncError(error) {
    logSchedulerError('syncAllAccounts', error);
    
    // Log memory usage on error
    const memUsage = process.memoryUsage();
    logMemoryUsage(Math.round(memUsage.heapUsed / 1024 / 1024));
    
    // Force garbage collection on error
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Schedule with recovery mechanism (legacy method for backward compatibility)
   */
  scheduleWithRecovery(interval, syncIntervalId) {
    try {
      // Clear any existing interval
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
      }
      
      // Use continuous mode instead of fixed intervals
      this.schedule();
      
      logContinuousSyncModeEnabled();
      return null; // No interval ID needed for continuous mode
    } catch (error) {
      logSyncSchedulingError(error.message);
      // Retry after 2 minutes
      setTimeout(() => this.scheduleWithRecovery(interval, syncIntervalId), 120000);
      return null;
    }
  }

  /**
   * Run sync with error handling (legacy method)
   */
  async runSync() {
    try {
      logScheduledSyncStarted();
      await this.dataSync.syncAllAccounts();
      logScheduledSyncCompleted();
    } catch (error) {
      logScheduledSyncError(error.message);
      throw error;
    }
  }

  /**
   * Stop continuous sync
   */
  stop() {
    this.isRunning = false;
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    logContinuousSyncStopped();
  }
}

module.exports = SyncScheduler; 