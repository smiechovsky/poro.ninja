const fs = require("fs");
const path = require("path");
const db = require("../db"); // Twój plik z połączeniem do bazy
const waitForDb = require('./waitForDb');
const { 
  logDbInitStart, 
  logDbConnectionConfirmed, 
  logDbInitComplete, 
  logDbInitError,
  logTableExists,
  logTableCreated,
  logTablesSummary
} = require('../debugger/utils');

async function checkTableExists(tableName) {
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

async function initializeTables() {
  try {
    logDbInitStart();
    
    // Wait for database to be ready
    await waitForDb();
    
    logDbConnectionConfirmed();
    
    const initSQLPath = path.join(__dirname, "..", "init.sql");
    
    if (!fs.existsSync(initSQLPath)) {
      console.error('❌ SQL file not found:', initSQLPath);
      throw new Error(`SQL file not found: ${initSQLPath}`);
    }
    
    const initSQL = fs.readFileSync(initSQLPath, "utf8");
    
    // Check which tables exist before creating them
    const tablesToCheck = ['accountstosync', 'championmasteryhistory', 'championgrades', 'champions'];
    const existingTables = [];
    
    for (const table of tablesToCheck) {
      const exists = await checkTableExists(table);
      if (exists) {
        existingTables.push(table);
        logTableExists(table);
      }
    }
    
    // Execute SQL initialization
    await db.query(initSQL);
    
    // Check which tables were created (those that didn't exist before)
    const createdTables = [];
    for (const table of tablesToCheck) {
      if (!existingTables.includes(table)) {
        createdTables.push(table);
        logTableCreated(table);
      }
    }
    
    // Log summary for level 1
    logTablesSummary(existingTables.length, createdTables.length);
    
    logDbInitComplete();
  } catch (err) {
    logDbInitError(err);
    throw err;
  }
}

module.exports = initializeTables;