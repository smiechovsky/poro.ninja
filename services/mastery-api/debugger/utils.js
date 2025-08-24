const { logL, isDebugEnabled, isDetailedDebugEnabled } = require('./config');

const UTILS_PREFIX = 'UTILS';

function logDbInitStart() {
  if (isDebugEnabled()) {
    logL(UTILS_PREFIX, 1, 'Starting database table initialization...');
  }
}

function logDbConnectionConfirmed() {
  if (isDebugEnabled()) {
    logL(UTILS_PREFIX, 1, 'Database connection confirmed, proceeding with initialization...');
  }
}

function logDbInitComplete() {
  if (isDebugEnabled()) {
    logL(UTILS_PREFIX, 1, 'Database tables initialized successfully');
  }
}

function logDbInitError(error) {
  logL(UTILS_PREFIX, 0, '❌ Error initializing tables:', error);
}

function logTableExists(tableName) {
  if (isDetailedDebugEnabled()) {
    logL(UTILS_PREFIX, 2, `Table '${tableName}' already exists`);
  }
}

function logTableCreated(tableName) {
  if (isDetailedDebugEnabled()) {
    logL(UTILS_PREFIX, 2, `Table '${tableName}' created successfully`);
  }
}

function logTablesSummary(existingCount, createdCount) {
  if (isDebugEnabled()) {
    if (existingCount > 0 && createdCount > 0) {
      logL(UTILS_PREFIX, 1, `${existingCount} tables already exist, ${createdCount} tables created`);
    } else if (existingCount > 0) {
      logL(UTILS_PREFIX, 1, `All ${existingCount} tables already exist`);
    } else if (createdCount > 0) {
      logL(UTILS_PREFIX, 1, `All ${createdCount} tables created successfully`);
    } else {
      logL(UTILS_PREFIX, 1, 'No tables to initialize');
    }
  }
}

function logDbWaitStart() {
  if (isDebugEnabled()) {
    logL(UTILS_PREFIX, 1, 'Checking database connection...');
  }
}

function logDbWaitAttempt(attempt, total) {
  if (isDebugEnabled()) {
    logL(UTILS_PREFIX, 1, `Attempt ${attempt}/${total}`);
  }
}

function logDbReady() {
  if (isDebugEnabled()) {
    logL(UTILS_PREFIX, 1, 'Database is ready!');
  }
}

function logDbWaitError() {
  logL(UTILS_PREFIX, 0, '💥 Database not ready after multiple attempts');
}

module.exports = {
  logDbInitStart,
  logDbConnectionConfirmed,
  logDbInitComplete,
  logDbInitError,
  logTableExists,
  logTableCreated,
  logTablesSummary,
  logDbWaitStart,
  logDbWaitAttempt,
  logDbReady,
  logDbWaitError,
  UTILS_PREFIX
}; 