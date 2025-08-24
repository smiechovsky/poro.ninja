const { 
  logMemoryUsage, 
  logHighMemoryUsage, 
  logForcedGarbageCollection 
} = require('../debugger/memoryMonitor');

/**
 * Memory monitoring utility
 */
class MemoryMonitor {
  constructor(checkInterval = 300000, threshold = 0.8) {
    this.checkInterval = checkInterval; // 5 minutes
    this.threshold = threshold; // 80% of heap used
    this.intervalId = null;
  }

  /**
   * Start memory monitoring
   */
  start() {
    this.intervalId = setInterval(() => {
      this.checkMemoryUsage();
    }, this.checkInterval);
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check current memory usage
   */
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed / 1024 / 1024; // MB
    const heapTotal = memUsage.heapTotal / 1024 / 1024; // MB
    const heapUsage = heapUsed / heapTotal;
    
          logMemoryUsage(heapUsed, heapTotal, heapUsage);
    
    if (heapUsage > this.threshold) {
              logHighMemoryUsage(heapUsage);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logForcedGarbageCollection();
      }
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
  }
}

module.exports = MemoryMonitor; 