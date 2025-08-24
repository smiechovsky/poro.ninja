const { logL } = require('./config');

const DB_PREFIX = 'ACCOUNTS-FINDER';

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

module.exports = {
  logDbInit,
  logDbConnection,
  logDbConnected,
  logDbError,
  logTableExists,
  logTableCreated,
  logDbInitComplete,
  logDbConnectionSuccess,
  DB_PREFIX
}; 