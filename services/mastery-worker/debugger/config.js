// Debug configuration and logging utilities
//
// LOGS_LEVEL Configuration:
// 0 = Database connection success, table existence/creation, service startup, route access
// 1 = Level 0 + start/end markers and overall aggregated result for each request
// 2 = Level 1 + detailed data processing steps, individual account lookups, auto-add operations
//
const LOGS_LEVEL = parseInt(process.env.LOGS_LEVEL || '0', 10);

function isDebugEnabled() {
  return LOGS_LEVEL >= 1;
}

function isDetailedDebugEnabled() {
  return LOGS_LEVEL >= 2;
}

function logL(prefix, level, ...args) {
  if (LOGS_LEVEL >= level) {
    console.log(`[${prefix}] [LOGS-LEVEL:${level}]`, ...args);
  }
}

function getLogsLevel() {
  return LOGS_LEVEL;
}

module.exports = {
  logL,
  isDebugEnabled,
  isDetailedDebugEnabled,
  getLogsLevel,
  LOGS_LEVEL
}; 