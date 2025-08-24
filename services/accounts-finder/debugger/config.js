// Debug configuration and logging utilities for Accounts Finder service
//
// LOGS_LEVEL Configuration:
// 0 = Service startup, database connection, loop start/end, basic progress
// 1 = Level 0 + detailed progress, rate limit status, loop summaries
// 2 = Level 1 + account processing details, match fetching, participant analysis
//
const LOGS_LEVEL = parseInt(process.env.LOGS_LEVEL || '0');

function logL(debuggerName, level, ...args) {
  if (LOGS_LEVEL >= level) {
    console.log(`[${debuggerName}] [LOGS-LEVEL:${level}]`, ...args);
  }
}

function isDebugEnabled() {
  return LOGS_LEVEL >= 1;
}

function isDetailedDebugEnabled() {
  return LOGS_LEVEL >= 2;
}

function getLogsLevel() {
  return LOGS_LEVEL;
}

module.exports = {
  LOGS_LEVEL,
  logL,
  isDebugEnabled,
  isDetailedDebugEnabled,
  getLogsLevel
}; 