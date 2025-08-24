const { logL } = require('./config');

const MONITOR_PREFIX = 'MONITOR';

function logMemoryUsage(heapUsed, heapTotal, heapUsage) {
  logL(MONITOR_PREFIX, 0, `📊 Memory: ${heapUsed.toFixed(1)}MB / ${heapTotal.toFixed(1)}MB (${(heapUsage * 100).toFixed(1)}%)`);
}

function logHighMemoryUsage(heapUsage) {
  logL(MONITOR_PREFIX, 0, `⚠️ High memory usage detected: ${(heapUsage * 100).toFixed(1)}%`);
}

function logForcedGarbageCollection() {
  logL(MONITOR_PREFIX, 0, '🗑️ Forced garbage collection');
}

module.exports = {
  logMemoryUsage,
  logHighMemoryUsage,
  logForcedGarbageCollection,
  MONITOR_PREFIX
}; 