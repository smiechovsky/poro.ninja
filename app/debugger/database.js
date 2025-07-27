const { logL, isDetailedDebugEnabled } = require('./config');

const DB_PREFIX = '[DATABASE]';

function debugDatabaseConfig() {
  if (isDetailedDebugEnabled()) {
    console.log('=== DATABASE CONFIGURATION DEBUG ===');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_DATABASE:', process.env.DB_DATABASE);
    console.log('DB_USERNAME:', process.env.DB_USERNAME);
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '[HIDDEN]' : 'NOT SET');
    console.log('=====================================');
  }
}

function logDatabaseConnection() {
  logL(DB_PREFIX, 2, 'Database client connected');
}

function logDatabaseError(err) {
  console.error('❌ [DATABASE] Database pool error:', err);
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