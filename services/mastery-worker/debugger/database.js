const { logL, isDetailedDebugEnabled } = require('./config');

const DB_PREFIX = 'DATABASE';

function debugDatabaseConfig() {
  if (isDetailedDebugEnabled()) {
    logL(DB_PREFIX, 2, '=== DATABASE CONFIGURATION DEBUG ===');
    logL(DB_PREFIX, 2, 'DB_HOST:', process.env.DB_HOST);
    logL(DB_PREFIX, 2, 'DB_PORT:', process.env.DB_PORT);
    logL(DB_PREFIX, 2, 'DB_DATABASE:', process.env.DB_DATABASE);
    logL(DB_PREFIX, 2, 'DB_USERNAME:', process.env.DB_USERNAME);
    logL(DB_PREFIX, 2, 'DB_PASSWORD:', process.env.DB_PASSWORD ? '[HIDDEN]' : 'NOT SET');
    logL(DB_PREFIX, 2, '=====================================');
  }
}

function logDatabaseConnection() {
  logL(DB_PREFIX, 2, 'Database client connected');
}

function logDatabaseError(err) {
  logL(DB_PREFIX, 0, '❌ Database pool error:', err);
}

function logDatabaseQuery(query, params) {
  if (isDetailedDebugEnabled()) {
    logL(DB_PREFIX, 2, 'Executing query:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
    if (params) logL(DB_PREFIX, 2, 'Query params:', params);
  }
}

module.exports = {
  debugDatabaseConfig,
  logDatabaseConnection,
  logDatabaseError,
  logDatabaseQuery,
  DB_PREFIX
}; 