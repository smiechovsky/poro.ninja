const { logAccountProcessingError } = require('../debugger/scheduler');

/**
 * Handles batch processing of accounts
 */
class BatchProcessor {
  constructor(dataSync) {
    this.dataSync = dataSync;
  }

  /**
   * Process a batch of accounts in parallel
   */
  async processBatch(accounts) {
    const batchPromises = accounts.map(async (account) => {
      try {
        const newEntries = await this.dataSync.syncChampionMastery(
          account.region, 
          account.puuid, 
          account.nickname, 
          account.tag
        );
        
        this.dataSync.totalNewEntries += newEntries;
        this.dataSync.processedAccounts++;
        
        // Update global metrics
        this.updateGlobalMetrics(newEntries, true, null);
        
        // Reset error count on success
        if (this.dataSync.errorCount > 0) {
          this.dataSync.errorCount = Math.max(0, this.dataSync.errorCount - 1);
        }
        
        return { success: true, newEntries };
      } catch (error) {
        return this.handleBatchError(account, error);
      }
    });

    return Promise.all(batchPromises);
  }

  /**
   * Handle errors during batch processing
   */
  handleBatchError(account, error) {
    // Don't count rate limit errors as failures since they're handled by retry logic
    if (error.response?.status === 429) {
      this.dataSync.errorCount++; // Count 429 errors for batch size adjustment
      logAccountProcessingError(account.nickname, account.tag, error);
      this.dataSync.processedAccounts++;
      
      // Update global metrics for 429 error
      this.updateGlobalMetrics(0, false, 429);
      
      return { success: false, error };
    }
    
    // Don't count timeout errors as failures since they're handled by retry logic
    if (error.response?.status === 504 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      logAccountProcessingError(account.nickname, account.tag, error);
      this.dataSync.processedAccounts++;
      
      // Update global metrics for 504 error
      this.updateGlobalMetrics(0, false, 504);
      
      return { success: false, error };
    }
    
    // Count other errors as failures
    this.dataSync.failedCount++;
    this.dataSync.errorCount++;
    logAccountProcessingError(account.nickname, account.tag, error);
    this.dataSync.processedAccounts++;
    
    // Update global metrics for other errors
    this.updateGlobalMetrics(0, false, 'other');
    
    return { success: false, error };
  }

  /**
   * Update global metrics for Prometheus
   */
  updateGlobalMetrics(newEntries, success, errorType) {
    // Update basic metrics
    global.accountsProcessed = (global.accountsProcessed || 0) + 1;
    global.newEntries = (global.newEntries || 0) + newEntries;
    
    if (!success) {
      global.failedAccounts = (global.failedAccounts || 0) + 1;
      global.totalErrors = (global.totalErrors || 0) + 1;
    }
    
    // Update error type counters
    if (errorType === 429) {
      global.error429Count = (global.error429Count || 0) + 1;
    } else if (errorType === 504) {
      global.error504Count = (global.error504Count || 0) + 1;
    }
    
    // Update batch processing metrics
    global.currentBatchSize = this.dataSync.batchSize || 1;
    global.concurrentBatches = this.dataSync.maxConcurrentBatches || 1;
    
    // Calculate processing rate (accounts per minute)
    const elapsedMinutes = (Date.now() - this.dataSync.startTime) / 60000;
    if (elapsedMinutes > 0) {
      global.processingRate = Math.round(global.accountsProcessed / elapsedMinutes);
    }
    
    // Calculate success rate
    if (global.accountsProcessed > 0) {
      global.successRate = Math.round(((global.accountsProcessed - global.failedAccounts) / global.accountsProcessed) * 100);
    }
    
    // Update average processing time
    if (global.accountsProcessed > 0) {
      global.avgProcessingTime = elapsedMinutes / global.accountsProcessed * 60; // in seconds
    }
  }

  /**
   * Create batches from accounts array
   */
  createBatches(accounts, batchSize, maxConcurrentBatches) {
    const batches = [];
    
    for (let i = 0; i < accounts.length; i += batchSize * maxConcurrentBatches) {
      const batchPromises = [];
      
      // Create multiple batches to run in parallel
      for (let j = 0; j < maxConcurrentBatches && i + j * batchSize < accounts.length; j++) {
        const batchStart = i + j * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, accounts.length);
        const batch = accounts.slice(batchStart, batchEnd);
        
        batchPromises.push(this.processBatch(batch));
      }
      
      batches.push(batchPromises);
    }
    
    return batches;
  }
}

module.exports = BatchProcessor; 