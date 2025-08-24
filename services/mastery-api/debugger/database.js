const { logL, isDetailedDebugEnabled } = require('./config');

const DB_PREFIX = 'MASTERY-API';

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

function logDbInit() {
  logL(DB_PREFIX, 0, 'Starting database table initialization...');
}

function logDbConnection() {
  logL(DB_PREFIX, 0, 'Checking database connection...');
}

function logDbConnected() {
  logL(DB_PREFIX, 0, 'Database connection confirmed, proceeding with initialization...');
}

function logDbError(message, error) {
  logL(DB_PREFIX, 0, `❌ ${message}:`, error);
}

function logTableExists(table) {
  logL(DB_PREFIX, 0, `Table ${table} already exists`);
}

function logTableCreated(table) {
  logL(DB_PREFIX, 0, `Table ${table} created successfully`);
}

function logDbInitComplete(existingCount, createdCount) {
  logL(DB_PREFIX, 0, 'Database tables initialized successfully');
  logL(DB_PREFIX, 1, `Tables summary: ${existingCount} existing, ${createdCount} created`);
}

function logDbConnectionSuccess() {
  logL(DB_PREFIX, 0, '✅ Database connection successful');
}

function logDatabaseQuery(query, params) {
  if (isDetailedDebugEnabled()) {
    logL(DB_PREFIX, 2, 'Executing query:', query.substring(0, 100) + (query.length > 100 ? '...' : ''));
    if (params) logL(DB_PREFIX, 2, 'Query params:', params);
  }
}

module.exports = {
  debugDatabaseConfig,
  logDbInit,
  logDbConnection,
  logDbConnected,
  logDbError,
  logTableExists,
  logTableCreated,
  logDbInitComplete,
  logDbConnectionSuccess,
  logDatabaseQuery,
  DB_PREFIX
}; 