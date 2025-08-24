const { Pool } = require('pg');
const { logL } = require('./debugger/config');
const { debugDatabaseConfig, logDbConnection, logDbError } = require('./debugger/database');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  
  // Optimized connection pool settings for parallel processing
  max: 15, // Reduced from 20 to prevent overwhelming the database
  min: 3,  // Reduced from 5 to save resources
  idleTimeoutMillis: 60000, // Increased to 60 seconds to reduce connection churn
  connectionTimeoutMillis: 5000, // Increased to 5 seconds for better reliability
  acquireTimeoutMillis: 10000, // Increased to 10 seconds for better reliability
  
  // Statement timeout to prevent long-running queries
  statement_timeout: 30000, // 30 seconds
  
  // Application name for monitoring
  application_name: 'mastery-api'
});

// Debug: Dodaj event listenery do pool
pool.on('connect', (client) => {
  logDbConnection();
});

pool.on('error', (err, client) => {
  logDbError('Database pool error', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logL('MASTERY-API', 0, 'Shutting down database pool...');
  pool.end();
});

process.on('SIGTERM', () => {
  logL('MASTERY-API', 0, 'Shutting down database pool...');
  pool.end();
});

module.exports = {
  query: (text, params) => {
    // Removed SQL and params logging for cleaner output
    return pool.query(text, params);
  },
  debugConfig: debugDatabaseConfig,
  
  // Add pool status for monitoring
  getPoolStatus: () => ({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  })
};