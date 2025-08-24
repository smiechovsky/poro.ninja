const fs = require("fs");
const path = require("path");
const db = require("../db");
const { 
  logDbInit, 
  logDbConnection, 
  logDbConnected, 
  logDbError, 
  logTableExists, 
  logTableCreated, 
  logDbInitComplete 
} = require('../debugger/database');

/**
 * Wait for database to be ready
 * @param {Object} db - Database connection object
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 */
async function waitForDb(db, maxAttempts = 10, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await db.query('SELECT 1');
      return true; // Database is ready
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Database connection failed after ${maxAttempts} attempts: ${error.message}`);
      }
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Check if table exists in database
 * @param {Object} db - Database connection object
 * @param {string} tableName - Name of the table to check
 */
async function checkTableExists(db, tableName) {
  try {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    return result.rows[0].exists;
  } catch (err) {
    return false;
  }
}

/**
 * Initialize database tables for Accounts Finder service
 * Uses the central database initialization system
 */
async function initializeTables() {
  try {
    logDbInit();
    
          logDbConnection();
    
    // Wait for database to be ready
    await waitForDb(db);
    
          logDbConnected();
    
    // Find the central init.sql file (mounted in container)
    const initSQLPath = path.join(__dirname, "..", "init.sql");
    
    if (!fs.existsSync(initSQLPath)) {
      logDbError('Central SQL file not found', initSQLPath);
      throw new Error(`Central SQL file not found: ${initSQLPath}`);
    }
    
    const initSQL = fs.readFileSync(initSQLPath, "utf8");
    
    // Define all tables that should exist
    const allTables = [
      'accountstosync',
      'championmasteryhistory', 
      'championgrades', 
      'champions',
      'scannedmatches',
      'playedwith'
    ];
    
    // Check which tables exist before creating them
    const existingTables = [];
    
    for (const table of allTables) {
      const exists = await checkTableExists(db, table);
      if (exists) {
        existingTables.push(table);
        logTableExists(table);
      }
    }
    
    // Execute SQL initialization
    await db.query(initSQL);
    
    // Check which tables were created (those that didn't exist before)
    const createdTables = [];
    for (const table of allTables) {
      if (!existingTables.includes(table)) {
        createdTables.push(table);
        logTableCreated(table);
      }
    }
    
    // Log summary
    logDbInitComplete(existingTables.length, createdTables.length);
    
    return {
      existingTables,
      createdTables,
      totalTables: allTables.length
    };
    
  } catch (err) {
    logDbError('Database initialization error', err.message);
    throw err;
  }
}

module.exports = initializeTables;