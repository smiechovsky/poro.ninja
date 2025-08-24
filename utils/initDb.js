const fs = require("fs");
const path = require("path");

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
 * Universal Database Initialization Utility
 * This utility can be used by any service to initialize the database
 * 
 * @param {Object} db - Database connection object
 * @param {string} serviceName - Name of the service (for logging)
 * @param {string} logL - Logging function from service's debugger
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

async function initializeDatabase(db, serviceName, logL) {
  try {
    logL(serviceName, 0, 'Starting database table initialization...');
    
    logL(serviceName, 0, 'Checking database connection...');
    
    // Wait for database to be ready
    await waitForDb(db);
    
    logL(serviceName, 0, 'Database connection confirmed, proceeding with initialization...');
    
    // Find the central init.sql file (in project root)
    const initSQLPath = path.join(__dirname, "..", "init.sql");
    
    if (!fs.existsSync(initSQLPath)) {
      logL(serviceName, 0, '❌ Central SQL file not found:', initSQLPath);
      throw new Error(`Central SQL file not found: ${initSQLPath}`);
    }
    
    const initSQL = fs.readFileSync(initSQLPath, "utf8");
    
    // Define all tables that should exist
    const allTables = [
      'accountstosync',
      'championmasteryhistory', 
      'championgrades', 
      'champions',
      'scannedmatches'
    ];
    
    // Check which tables exist before creating them
    const existingTables = [];
    
    for (const table of allTables) {
      const exists = await checkTableExists(db, table);
      if (exists) {
        existingTables.push(table);
        logL(serviceName, 0, `Table ${table} already exists`);
      }
    }
    
    // Execute SQL initialization
    await db.query(initSQL);
    
    // Check which tables were created (those that didn't exist before)
    const createdTables = [];
    for (const table of allTables) {
      if (!existingTables.includes(table)) {
        createdTables.push(table);
        logL(serviceName, 0, `Table ${table} created successfully`);
      }
    }
    
    // Log summary
    logL(serviceName, 0, `Database tables initialized successfully`);
    logL(serviceName, 1, `Tables summary: ${existingTables.length} existing, ${createdTables.length} created`);
    
    return {
      existingTables,
      createdTables,
      totalTables: allTables.length
    };
    
  } catch (err) {
    logL(serviceName, 0, '❌ Database initialization error:', err.message);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  checkTableExists,
  waitForDb
};