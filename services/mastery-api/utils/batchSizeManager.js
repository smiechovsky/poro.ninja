const { logBatchSizeAdjustment } = require('../debugger/scheduler');

/**
 * Manages adaptive batch size based on error rates
 */
class BatchSizeManager {
  constructor(dataSync) {
    this.dataSync = dataSync;
    this.timeWindow = 300000; // 5 minutes
  }

  /**
   * Adaptive batch size adjustment based on error rate
   */
  adjustBatchSize() {
    if (!this.dataSync.adaptiveBatchSize) return;
    
    const now = Date.now();
    
    // Reset error count if window has passed
    if (now - this.dataSync.lastErrorReset > this.timeWindow) {
      this.dataSync.errorCount = 0;
      this.dataSync.lastErrorReset = now;
    }
    
    const oldBatchSize = this.dataSync.batchSize;
    const oldConcurrent = this.dataSync.maxConcurrentBatches;
    
    // If error rate is high, reduce batch size
    if (this.dataSync.errorCount > 5 && this.dataSync.batchSize > 1) {
      this.dataSync.batchSize = Math.max(1, this.dataSync.batchSize - 1);
      this.dataSync.maxConcurrentBatches = Math.max(1, this.dataSync.maxConcurrentBatches - 1);
      
      if (oldBatchSize !== this.dataSync.batchSize) {
        logBatchSizeAdjustment(oldBatchSize, this.dataSync.batchSize, oldConcurrent, this.dataSync.maxConcurrentBatches, 'high error rate');
      }
    }
    
    // If error rate is low and we're doing well, gradually increase (but be more conservative)
    if (this.dataSync.errorCount < 1 && this.dataSync.batchSize < 3) {
      this.dataSync.batchSize = Math.min(3, this.dataSync.batchSize + 1);
      this.dataSync.maxConcurrentBatches = Math.min(1, this.dataSync.maxConcurrentBatches + 1);
      
      if (oldBatchSize !== this.dataSync.batchSize) {
        logBatchSizeAdjustment(oldBatchSize, this.dataSync.batchSize, oldConcurrent, this.dataSync.maxConcurrentBatches, 'low error rate');
      }
    }
  }

  /**
   * Get current batch configuration
   */
  getBatchConfig() {
    return {
      batchSize: this.dataSync.batchSize,
      maxConcurrentBatches: this.dataSync.maxConcurrentBatches,
      errorCount: this.dataSync.errorCount
    };
  }
}

module.exports = BatchSizeManager; 