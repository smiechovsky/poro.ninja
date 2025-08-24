const { logL } = require('./config');

const PROCESS_PREFIX = 'MASTERY-API';

function logShutdownReceived(signal) {
  logL(PROCESS_PREFIX, 0, `🛑 Received ${signal}, shutting down gracefully...`);
}

function logGracefulShutdownCompleted() {
  logL(PROCESS_PREFIX, 0, '✅ Graceful shutdown completed');
}

function logGracefulShutdownError() {
  logL(PROCESS_PREFIX, 0, '⚠️ Graceful shutdown with errors');
}

function logUncaughtException(error) {
  logL(PROCESS_PREFIX, 0, '❌ Uncaught Exception:', error);
  logL(PROCESS_PREFIX, 0, '📊 Stack trace:', error.stack);
}

function logUnhandledRejection(promise, reason) {
  logL(PROCESS_PREFIX, 0, '❌ Unhandled Rejection at:', promise, 'reason:', reason);
}

function logFinalMemoryUsage(memoryMB) {
  logL(PROCESS_PREFIX, 0, `📊 Final memory usage: ${memoryMB}MB`);
}

function logServerStartupError(error) {
  logL(PROCESS_PREFIX, 0, '❌ Server startup error:', error);
}

module.exports = {
  logShutdownReceived,
  logGracefulShutdownCompleted,
  logGracefulShutdownError,
  logUncaughtException,
  logUnhandledRejection,
  logFinalMemoryUsage,
  logServerStartupError,
  PROCESS_PREFIX
}; 