const { 
  logCurrentProgressDetails, 
  logFinalSummary,
  logOptimizationMetrics
} = require('../debugger/scheduler');
const { logProgress } = require('../debugger/scheduler');

/**
 * Handles progress logging and time estimation
 */
class ProgressLogger {
  constructor(dataSync) {
    this.dataSync = dataSync;
  }

  /**
   * Log current progress with time estimation
   */
  logCurrentProgress(totalAccounts) {
    const elapsedMinutes = (Date.now() - this.dataSync.startTime) / 60000;
    const progressPercentage = (this.dataSync.processedAccounts / totalAccounts) * 100;
    
    if (progressPercentage > 0) {
      const estimatedTotalMinutes = (elapsedMinutes / progressPercentage) * 100;
      const estimatedRemainingMinutes = estimatedTotalMinutes - elapsedMinutes;
      
      // Calculate processing rate
      const processingRate = elapsedMinutes > 0 ? Math.round(this.dataSync.processedAccounts / elapsedMinutes) : 0;
      
      // Calculate success rate
      const successRate = this.dataSync.processedAccounts > 0 ? 
        Math.round(((this.dataSync.processedAccounts - (this.dataSync.failedCount || 0)) / this.dataSync.processedAccounts) * 100) : 100;
      
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      logCurrentProgressDetails(
        progressPercentage,
        elapsedMinutes,
        estimatedTotalMinutes,
        this.dataSync.processedAccounts,
        totalAccounts,
        0, // processedMatches - not used in mastery-api
        0, // totalMatches - not used in mastery-api
        this.dataSync.totalNewEntries || 0, // uniqueFound -> totalNewEntries
        0, // duplicates - not used in mastery-api
        this.dataSync.failedCount || 0,
        Math.round(estimatedRemainingMinutes) || 0
      );
      
      // Log optimization metrics every 10 accounts
      if (this.dataSync.processedAccounts % 10 === 0) {
        logOptimizationMetrics(
          this.dataSync.batchSize || 1,
          this.dataSync.maxConcurrentBatches || 1,
          this.dataSync.errorCount || 0,
          processingRate,
          memoryUsageMB,
          successRate
        );
      }
    } else {
      // Log initial progress even if 0%
      logProgress(this.dataSync.processedAccounts, totalAccounts, elapsedMinutes, 0, 0, 0, this.dataSync.errorCount);
    }
  }

  /**
   * Log final summary
   */
  logFinalSummary(elapsedMinutes, totalAccounts) {
    logFinalSummary(
      elapsedMinutes,
      this.dataSync.processedAccounts,
      totalAccounts,
      this.dataSync.totalNewEntries,
      this.dataSync.failedCount
    );
  }

  /**
   * Check if progress should be logged
   */
  shouldLogProgress() {
    return this.dataSync.processedAccounts % 10 === 0;
  }

  /**
   * Check if garbage collection should be performed
   */
  shouldPerformGC() {
    return global.gc && this.dataSync.processedAccounts % 50 === 0;
  }
}

module.exports = ProgressLogger; 