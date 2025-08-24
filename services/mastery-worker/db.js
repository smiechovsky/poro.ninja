const { Pool } = require('pg');
const { debugDatabaseConfig, logDatabaseConnection, logDatabaseError } = require('./debugger/database');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
});

// Debug: Dodaj event listenery do pool
pool.on('connect', (client) => {
  logDatabaseConnection();
});

pool.on('error', (err, client) => {
  logDatabaseError(err);
});

module.exports = {
  query: (text, params) => {
    // Removed SQL and params logging for cleaner output
    return pool.query(text, params);
  },
  debugConfig: debugDatabaseConfig
};