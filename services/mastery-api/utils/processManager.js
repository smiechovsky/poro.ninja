const db = require('../db');
const { 
  logShutdownReceived,
  logGracefulShutdownCompleted,
  logGracefulShutdownError,
  logUncaughtException,
  logUnhandledRejection,
  logFinalMemoryUsage
} = require('../debugger/processManager');

/**
 * Manages process lifecycle and graceful shutdown
 */
class ProcessManager {
  constructor(memoryMonitor, syncIntervalId) {
    this.memoryMonitor = memoryMonitor;
    this.syncIntervalId = syncIntervalId;
    this.syncScheduler = null;
  }

  /**
   * Setup process event handlers
   */
  setupEventHandlers() {
    // Graceful shutdown handlers
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));

    // Error handlers
    process.on('uncaughtException', (error) => this.handleUncaughtException(error));
    process.on('unhandledRejection', (reason, promise) => this.handleUnhandledRejection(reason, promise));
  }

  /**
   * Handle graceful shutdown
   */
  async handleShutdown(signal) {
    logShutdownReceived(signal);
    
    // Stop memory monitoring
    if (this.memoryMonitor) {
      this.memoryMonitor.stop();
    }
    
    // Stop sync scheduler
    if (this.syncScheduler) {
      this.syncScheduler.stop();
    }
    
    // Clear sync interval (legacy)
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    
    // Close database connections
    try {
      await db.query('SELECT 1');
      logGracefulShutdownCompleted();
      process.exit(0);
    } catch (error) {
      logGracefulShutdownError();
      process.exit(1);
    }
  }

  /**
   * Handle uncaught exceptions
   */
  handleUncaughtException(error) {
    logUncaughtException(error);
    
    // Log memory usage before exit
    const memUsage = process.memoryUsage();
    logFinalMemoryUsage(Math.round(memUsage.heapUsed / 1024 / 1024));
    
    process.exit(1);
  }

  /**
   * Handle unhandled promise rejections
   */
  handleUnhandledRejection(reason, promise) {
    logUnhandledRejection(promise, reason);
    
    // Log memory usage before exit
    const memUsage = process.memoryUsage();
    logFinalMemoryUsage(Math.round(memUsage.heapUsed / 1024 / 1024));
    
    process.exit(1);
  }

  /**
   * Update sync interval ID (legacy)
   */
  updateSyncIntervalId(syncIntervalId) {
    this.syncIntervalId = syncIntervalId;
  }

  /**
   * Update sync scheduler reference
   */
  updateSyncScheduler(syncScheduler) {
    this.syncScheduler = syncScheduler;
  }
}

module.exports = ProcessManager; 