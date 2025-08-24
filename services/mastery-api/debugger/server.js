const { getLogsLevel, logL, isDebugEnabled } = require('./config');

const SERVER_PREFIX = 'MASTERY-API';

function logServerStart(port) {
  logL(SERVER_PREFIX, 0, `Server running on port ${port}`);
}

function logLogsLevel() {
  if (isDebugEnabled()) {
    logL(SERVER_PREFIX, 1, `LOGS_LEVEL set to: ${getLogsLevel()}`);
  }
}

function logServicesRunning() {
  if (isDebugEnabled()) {
    logL(SERVER_PREFIX, 1, 'All services are running in loop');
  }
}

module.exports = {
  logServerStart,
  logLogsLevel,
  logServicesRunning,
  SERVER_PREFIX
}; 