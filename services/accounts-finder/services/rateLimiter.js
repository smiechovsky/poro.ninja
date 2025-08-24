const { 
  logRateLimitReached, 
  logRateLimitReset 
} = require('../debugger/rateLimiter');

class RateLimiter {
  constructor() {
    // Local endpoint caps (10s windows), but actual capacity comes from shared 2-min budget
    this.limits = {
      'getMatchIds': { requests: 2000, window: 10000 },
      'getMatchDetails': { requests: 2000, window: 10000 },
      'getAccountInfo': { requests: 1000, window: 60000 }, // account-v1 1000/min
      'getMastery': { requests: 20000, window: 10000 }
    };

    this.requestCounts = {};
    this.lastReset = {};
    this.waitingUntil = {};
    this.totalWaits = 0;
    this.totalWaitTime = 0;

    // Shared 2-minute budget (derived per-10s limit) – mirror of mastery-api
    this.globalWindow = 10000; // 10s
    this.budgetWindow = parseInt(process.env.BUDGET_WINDOW_MS || String(2 * 60 * 1000), 10);
    this.budgetLimit = parseInt(process.env.BUDGET_LIMIT_TOTAL || '100', 10);
    this.globalLimit = Math.max(1, Math.floor(this.budgetLimit * (this.globalWindow / this.budgetWindow)));
    this.globalRequestCount = 0;
    this.globalLastReset = Date.now();

    // Redis client (lazy)
    try {
      const { createClient } = require('redis');
      const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`;
      this.redis = createClient({ url });
      this.redis.on('error', () => {});
      this.redis.connect().catch(() => { this.redis = null; });
    } catch (_) {
      this.redis = null;
    }
  }

  /**
   * Check global API key usage
   * @returns {boolean} - True if global limit allows request
   */
  canMakeGlobalRequest() {
    const now = Date.now();
    
    // Reset global counter if window has passed
    if ((now - this.globalLastReset) >= this.globalWindow) {
      this.globalRequestCount = 0;
      this.globalLastReset = now;
    }

    return this.globalRequestCount < this.globalLimit;
  }

  /**
   * Record global request
   */
  recordGlobalRequest() {
    this.globalRequestCount++;
    // Shared 10s counter
    if (this.redis) {
      const now = Date.now();
      const winStart = now - (now % this.globalWindow);
      const key = `rl:global:${winStart}`;
      this.redis.incr(key).then(() => this.redis.pttl(key)).then(ttl => {
        if (ttl < 0) this.redis.pexpire(key, this.globalWindow).catch(() => {});
      }).catch(() => {});
    }
  }

  /**
   * Check if we can make a request for the given endpoint
   * @param {string} endpoint - API endpoint name
   * @returns {boolean} - True if request can be made
   */
  canMakeRequest(endpoint) {
    // First check global limit
    if (!this.canMakeGlobalRequest()) {
      return false;
    }
    
    const now = Date.now();
    const limit = this.limits[endpoint];
    
    if (!limit) {
      return true; // No limit set for this endpoint
    }

    // Reset counter if window has passed
    if (!this.lastReset[endpoint] || (now - this.lastReset[endpoint]) >= limit.window) {
      this.requestCounts[endpoint] = 0;
      this.lastReset[endpoint] = now;
    }

    return this.requestCounts[endpoint] < limit.requests;
  }

  /**
   * Record a request for rate limiting
   * @param {string} endpoint - API endpoint name
   */
  recordRequest(endpoint) {
    // Record global request first
    this.recordGlobalRequest();
    
    if (!this.limits[endpoint]) {
      return;
    }

    if (!this.requestCounts[endpoint]) {
      this.requestCounts[endpoint] = 0;
    }
    
    this.requestCounts[endpoint]++;
  }

  /**
   * Calculate wait time for rate limit reset
   * @param {string} endpoint - API endpoint name
   * @returns {number} - Milliseconds to wait
   */
  getWaitTime(endpoint) {
    const now = Date.now();
    const limit = this.limits[endpoint];
    
    if (!limit || !this.lastReset[endpoint]) {
      return 0;
    }

    const timeSinceReset = now - this.lastReset[endpoint];
    const timeUntilReset = limit.window - timeSinceReset;
    
    return Math.max(0, timeUntilReset);
  }

  /**
   * Get current usage for endpoint
   * @param {string} endpoint - API endpoint name
   * @returns {Object} - Usage information
   */
  getUsage(endpoint) {
    const limit = this.limits[endpoint];
    if (!limit) {
      return { current: 0, limit: 0, remaining: 0, resetIn: 0 };
    }

    const current = this.requestCounts[endpoint] || 0;
    const resetIn = this.getWaitTime(endpoint);
    
    return {
      current,
      limit: limit.requests,
      remaining: Math.max(0, limit.requests - current),
      resetIn
    };
  }

  /**
   * Wait if rate limit is reached
   * @param {string} endpoint - API endpoint name
   * @returns {Promise<void>}
   */
  async waitIfNeeded(endpoint) {
    if (this.canMakeRequest(endpoint)) {
      return;
    }

    // Determine which limit is causing the wait
    const globalCanMake = this.canMakeGlobalRequest();
    const endpointCanMake = this.requestCounts[endpoint] < (this.limits[endpoint]?.requests || Infinity);
    
    let waitTime = 0;
    let reason = '';
    
    if (!globalCanMake) {
      waitTime = this.getGlobalWaitTime();
      reason = 'global API limit';
    } else if (!endpointCanMake) {
      waitTime = this.getWaitTime(endpoint);
      reason = `${endpoint} limit`;
    }
    
    this.totalWaits++;
    this.totalWaitTime += waitTime;
    
            logRateLimitReached(reason, waitTime);
    
    await new Promise(resolve => setTimeout(resolve, waitTime + 100)); // Add 100ms buffer
    
    // Reset counters after waiting
    if (!globalCanMake) {
      this.globalRequestCount = 0;
      this.globalLastReset = Date.now();
    }
    if (!endpointCanMake) {
      this.requestCounts[endpoint] = 0;
      this.lastReset[endpoint] = Date.now();
    }
    
          logRateLimitReset();
  }

  /**
   * Calculate global wait time
   * @returns {number} - Milliseconds to wait
   */
  getGlobalWaitTime() {
    const now = Date.now();
    const timeSinceReset = now - this.globalLastReset;
    const timeUntilReset = this.globalWindow - timeSinceReset;
    
    return Math.max(0, timeUntilReset);
  }

  /**
   * Get global usage information
   * @returns {Object} - Global usage information
   */
  getGlobalUsage() {
    const resetIn = this.getGlobalWaitTime();
    
    return {
      current: this.globalRequestCount,
      limit: this.globalLimit,
      remaining: Math.max(0, this.globalLimit - this.globalRequestCount),
      resetIn
    };
  }

  /**
   * Get status of all endpoints
   * @returns {Object} - Status of all endpoints
   */
  getStatus() {
    const status = {
      global: this.getGlobalUsage()
    };
    
    for (const endpoint of Object.keys(this.limits)) {
      status[endpoint] = this.getUsage(endpoint);
    }
    return status;
  }

  /**
   * Get overall statistics
   * @returns {Object} - Overall statistics
   */
  getStats() {
    return {
      totalWaits: this.totalWaits,
      totalWaitTime: this.totalWaitTime,
      averageWaitTime: this.totalWaits > 0 ? this.totalWaitTime / this.totalWaits : 0,
      globalRequests: this.globalRequestCount,
      globalLimit: this.globalLimit
    };
  }
}

module.exports = RateLimiter; 