const db = require('../db');
const { logUserNotFound } = require('../debugger/scheduler');

/**
 * User ID cache manager to reduce database queries
 */
class UserCache {
  constructor(cacheSize = 500) {
    this.cache = new Map();
    this.cacheSize = cacheSize;
  }

  /**
   * Get user_id from cache or database
   */
  async getUserId(puuid) {
    if (this.cache.has(puuid)) {
      return this.cache.get(puuid);
    }

    const { rows: userRows } = await db.query(
      'SELECT id FROM AccountsToSync WHERE puuid = $1',
      [puuid]
    );

    if (userRows.length === 0) {
      logUserNotFound(puuid);
      return null;
    }

    const userId = userRows[0].id;
    
    // Limit cache size to prevent memory issues
    if (this.cache.size >= this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(puuid, userId);
    return userId;
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getSize() {
    return this.cache.size;
  }
}

module.exports = UserCache; 