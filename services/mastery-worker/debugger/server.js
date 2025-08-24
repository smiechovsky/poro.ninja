const { getLogsLevel, logL, isDebugEnabled } = require('./config');

const SERVER_PREFIX = 'MASTERY-WORKER';

function logServerStart(port) {
  logL(SERVER_PREFIX, 0, `Mastery Worker server running on port ${port}`);
}

function logServerError(error) {
  logL(SERVER_PREFIX, 0, '❌ Error:', error.stack);
}

function logLogsLevel() {
  if (isDebugEnabled()) {
    logL(SERVER_PREFIX, 1, `LOGS_LEVEL set to: ${getLogsLevel()}`);
  }
}

module.exports = {
  logServerStart,
  logServerError,
  logLogsLevel,
  SERVER_PREFIX
}; 