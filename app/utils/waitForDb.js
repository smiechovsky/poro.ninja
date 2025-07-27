const db = require('../db');
const { 
  logDbWaitStart, 
  logDbWaitAttempt, 
  logDbReady, 
  logDbWaitError 
} = require('../debugger/utils');

module.exports = async function waitForDb(retries = 10, delay = 2000) {
  logDbWaitStart();
  
  for (let i = 0; i < retries; i++) {
    try {
      logDbWaitAttempt(i + 1, retries);
      await db.query('SELECT 1 as test');
      logDbReady();
      return;
    } catch (err) {
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  
  logDbWaitError();
  throw new Error('Database not ready after multiple attempts');
}; 