const dotenv = require('dotenv');

dotenv.config();

// Set default LOGS_LEVEL if not defined
if (!process.env.LOGS_LEVEL) {
  process.env.LOGS_LEVEL = '0';
}

const LOGS_LEVEL = parseInt(process.env.LOGS_LEVEL, 10);

function logL(prefix, level, ...args) {
  if (LOGS_LEVEL >= level) {
    console.log(`${prefix} [LOGS-LEVEL:${level}]`, ...args);
  }
}

function getLogsLevel() {
  return LOGS_LEVEL;
}

function isDebugEnabled() {
  return LOGS_LEVEL > 0;
}

function isDetailedDebugEnabled() {
  return LOGS_LEVEL >= 2;
}

module.exports = {
  logL,
  getLogsLevel,
  isDebugEnabled,
  isDetailedDebugEnabled,
  LOGS_LEVEL
}; 