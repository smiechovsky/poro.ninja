const { logL } = require('./config');

const API_PREFIX = 'API';

function logRiotApiError(error) {
  logL(API_PREFIX, 0, '❌ Riot API error:', error.message);
}

function logAddAccountError(error) {
  logL(API_PREFIX, 0, '❌ Add account error:', error);
}

function logForceSyncError(error) {
  logL(API_PREFIX, 0, '❌ Force sync error:', error);
}

module.exports = {
  logRiotApiError,
  logAddAccountError,
  logForceSyncError,
  API_PREFIX
}; 