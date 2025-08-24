const { getLogsLevel, logL, isDebugEnabled } = require('./config');

const SERVER_PREFIX = 'ACCOUNTS-FINDER';

function logServerStart() {
  logL(SERVER_PREFIX, 0, '🚀 Starting Accounts Finder service...');
}

function logServerStarted() {
  logL(SERVER_PREFIX, 0, '✅ Accounts Finder service started successfully');
}

function logLogsLevel() {
  if (isDebugEnabled()) {
    logL(SERVER_PREFIX, 1, `LOGS_LEVEL set to: ${getLogsLevel()}`);
  }
}

module.exports = {
  logServerStart,
  logServerStarted,
  logLogsLevel,
  SERVER_PREFIX
}; 