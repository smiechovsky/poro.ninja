const { logRateLimitRetry } = require('../debugger/api');
const { createClient } = require('redis');

/**
 * Manages API rate limiting with adaptive backoff
 */
class RateLimiter {
  constructor() {
    this.masteryRequestCount = 0;
    this.masteryPriorityUsed = 0;
    this.masteryLastReset = Date.now();
    // Per-endpoint (mastery) 10s window
    this.masteryLimit = parseInt(process.env.MASTERY_LIMIT_PER_10S || '20000', 10);
    this.masteryWindow = parseInt(process.env.MASTERY_WINDOW_MS || '10000', 10);
    
    // Global API key usage tracking
    this.globalRequestCount = 0;
    this.globalPriorityUsed = 0;
    this.globalLastReset = Date.now();
    // Global 10s window (aggregate across endpoints)
    this.globalWindow = parseInt(process.env.GLOBAL_WINDOW_MS || '10000', 10);
    // Two-minute budgeting (for developer key caps)
    this.budgetWindow = parseInt(process.env.BUDGET_WINDOW_MS || String(2 * 60 * 1000), 10); // default 2 minutes
    this.budgetLimit = parseInt(process.env.BUDGET_LIMIT_TOTAL || '100', 10); // default 100 per window
    this.budgetLastReset = Date.now();
    this.budgetUsedTotal = 0;
    this.budgetUsed = {
      discovery: 0,        // new accounts scanning (highest priority)
      priorityRescan: 0,   // on-demand/forced user sync
      staleRescan: 0,      // >24h stale rescan
      background: 0        // remaining background usage
    };
    // Allocation targets (percentages should sum to 100)
    this.budgetAlloc = {
      discovery: parseInt(process.env.BUDGET_DISCOVERY_PERCENT || '50', 10),
      priorityRescan: parseInt(process.env.BUDGET_PRIORITY_PERCENT || '20', 10),
      staleRescan: parseInt(process.env.BUDGET_STALE_PERCENT || '20', 10),
      background: parseInt(process.env.BUDGET_BACKGROUND_PERCENT || '10', 10)
    };

    // If per-10s limits are not provided, derive them from the 2-minute budget to avoid many env vars
    const derivedPer10s = Math.max(1, Math.floor(this.budgetLimit * (this.globalWindow / this.budgetWindow)));
    this.globalLimit = parseInt(process.env.GLOBAL_LIMIT_PER_10S || String(derivedPer10s), 10);
    // Align mastery per-10s limit to the same derived value by default
    this.masteryLimit = parseInt(process.env.MASTERY_LIMIT_PER_10S || String(derivedPer10s), 10);

    
    // Adaptive rate limiting with better recovery
    this.adaptiveMode = false;
    this.rateLimitErrors = 0;
    this.timeoutErrors = 0;
    this.lastRateLimitError = 0;
    this.lastTimeoutError = 0;
    this.backoffMultiplier = 1;
    
    // Log throttling to reduce spam
    this.lastRateLimitLog = 0;
    this.rateLimitLogThrottle = 5000; // Log rate limit messages only every 5 seconds
    
    // Success tracking for recovery
    this.successfulRequests = 0;
    this.lastSuccessReset = Date.now();

    // Reserved capacity for priority requests (forced syncs)
    this.priorityReservePercent = parseInt(process.env.PRIORITY_RESERVE_PERCENT || '5', 10); // % of current limit
    this.priorityReserveMin = parseInt(process.env.PRIORITY_RESERVE_MIN || '3', 10); // minimum tokens per window
    // Redis client (lazy)
    this.redis = null;
  }

  // Lazy Redis init
  async initRedis() {
    if (this.redis) return true;
    try {
      const url = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`;
      this.redis = createClient({ url });
      this.redis.on('error', () => {});
      await this.redis.connect();
      return true;
    } catch (_) {
      this.redis = null;
      return false;
    }
  }

  // Helper to compute aligned window start
  getWindowStart(now, windowMs) {
    return now - (now % windowMs);
  }

  // INCR with TTL (no gating, just accounting). Returns current value or null on failure
  async incrWithTtl(key, ttlMs) {
    if (!(await this.initRedis())) return null;
    try {
      const val = await this.redis.incr(key);
      const ttl = await this.redis.pttl(key);
      if (ttl < 0) {
        await this.redis.pexpire(key, ttlMs);
      }
      return val;
    } catch (_) {
      return null;
    }
  }

  // Read integer value
  async getInt(key) {
    if (!(await this.initRedis())) return null;
    try {
      const v = await this.redis.get(key);
      return v ? parseInt(v, 10) : 0;
    } catch (_) {
      return null;
    }
  }

  /**
   * Throttled rate limit logging
   */
  logRateLimitThrottled(message) {
    const now = Date.now();
    if (now - this.lastRateLimitLog > this.rateLimitLogThrottle) {
      logRateLimitRetry(message);
      this.lastRateLimitLog = now;
    }
  }

  /**
   * Track successful requests for recovery
   */
  trackSuccess() {
    this.successfulRequests++;
    const now = Date.now();
    
    // Reset success counter every 5 minutes
    if (now - this.lastSuccessReset > 300000) {
      this.successfulRequests = 0;
      this.lastSuccessReset = now;
    }
    
    // If we have many successful requests, gradually recover (but be more conservative)
    if (this.successfulRequests > 200 && this.adaptiveMode) {
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.02, 1.0);
      this.masteryLimit = Math.floor(20000 * this.backoffMultiplier);
      this.globalLimit = Math.floor(6000 * this.backoffMultiplier);
    }
  }

  /**
   * Adaptive rate limiting - adjust limits based on 429 errors
   */
  handleRateLimitError() {
    const now = Date.now();
    this.rateLimitErrors++;
    
    // If we get any 429 error, immediately reduce limits
    this.adaptiveMode = true;
    this.backoffMultiplier = Math.min(this.backoffMultiplier * 0.5, 0.2); // Very aggressive reduction
    
    // Reduce limits more significantly
    this.masteryLimit = Math.floor(20000 * this.backoffMultiplier);
    this.globalLimit = Math.floor(6000 * this.backoffMultiplier);
    
    this.lastRateLimitError = now;
  }

  /**
   * Handle timeout errors (504, etc.)
   */
  handleTimeoutError() {
    const now = Date.now();
    this.timeoutErrors++;
    
    // If we get multiple timeouts, reduce concurrency but don't be as aggressive
    if (this.timeoutErrors >= 3 && (now - this.lastTimeoutError) < 60000) {
      this.adaptiveMode = true;
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 0.8, 0.5); // Less aggressive for timeouts
      
      this.masteryLimit = Math.floor(20000 * this.backoffMultiplier);
      this.globalLimit = Math.floor(6000 * this.backoffMultiplier);
    }
    
    this.lastTimeoutError = now;
  }

  /**
   * Reset adaptive mode if no errors for a while
   */
  resetAdaptiveMode() {
    const now = Date.now();
    if (this.adaptiveMode && (now - this.lastRateLimitError) > 300000 && (now - this.lastTimeoutError) > 300000) { // 5 minutes
      this.adaptiveMode = false;
      this.backoffMultiplier = 1;
      this.rateLimitErrors = 0;
      this.timeoutErrors = 0;
      
      // Restore original limits
      this.masteryLimit = 20000;
      this.globalLimit = 6000;
    }
  }

  /**
   * Compute reserved tokens for current window
   */
  getReservedTokens(limit) {
    const byPercent = Math.floor((limit * this.priorityReservePercent) / 100);
    return Math.max(byPercent, this.priorityReserveMin);
  }

  /**
   * Reset 2-minute budget window if elapsed
   */
  resetBudgetWindow() {
    const now = Date.now();
    if ((now - this.budgetLastReset) >= this.budgetWindow) {
      this.budgetLastReset = now;
      this.budgetUsedTotal = 0;
      this.budgetUsed.discovery = 0;
      this.budgetUsed.priorityRescan = 0;
      this.budgetUsed.staleRescan = 0;
      this.budgetUsed.background = 0;
    }
  }

  /**
   * Check if category can consume from 2-minute budget, honoring priorities.
   * discovery > priorityRescan > staleRescan > background. Background can consume leftover only.
   */
  canConsumeBudget(category) {
    this.resetBudgetWindow();
    const totalRemaining = this.budgetLimit - this.budgetUsedTotal;
    if (totalRemaining <= 0) return false;

    const targetFor = (cat) => Math.floor((this.budgetAlloc[cat] * this.budgetLimit) / 100);
    const usedFor = (cat) => this.budgetUsed[cat] || 0;

    if (category === 'background') {
      // Background only uses leftover after higher priorities' target allocations
      const reservedForHigher = targetFor('discovery') + targetFor('priorityRescan') + targetFor('staleRescan');
      const mustReserve = Math.max(reservedForHigher - (this.budgetUsed.discovery + this.budgetUsed.priorityRescan + this.budgetUsed.staleRescan), 0);
      return (totalRemaining - mustReserve) > 0;
    }

    // For higher priorities: allow up to their target, else allow borrowing from lower-priority target + background
    const target = targetFor(category);
    if (usedFor(category) < target) return true;
    // Borrow from lower priorities
    if (category === 'discovery') {
      return totalRemaining > 0; // can borrow from all
    }
    if (category === 'priorityRescan') {
      const lowerRemaining = (targetFor('staleRescan') - usedFor('staleRescan')) + (targetFor('background') - usedFor('background'));
      return (totalRemaining > 0) && (lowerRemaining > 0);
    }
    if (category === 'staleRescan') {
      const lowerRemaining = (targetFor('background') - usedFor('background'));
      return (totalRemaining > 0) && (lowerRemaining > 0);
    }
    return false;
  }

  /**
   * Record budget consumption for a category
   */
  recordBudget(category) {
    this.resetBudgetWindow();
    const cat = (['discovery','priorityRescan','staleRescan','background'].includes(category)) ? category : 'background';
    this.budgetUsed[cat] = (this.budgetUsed[cat] || 0) + 1;
    this.budgetUsedTotal += 1;

    // Also push shared counters to Redis for global visibility
    const now = Date.now();
    const winStart = this.getWindowStart(now, this.budgetWindow);
    const totalKey = `rl:budget:${winStart}:total`;
    const catKey = `rl:budget:${winStart}:${cat}`;
    this.incrWithTtl(totalKey, this.budgetWindow);
    this.incrWithTtl(catKey, this.budgetWindow);
  }

  /**
   * Check global API key usage
   */
  canMakeGlobalRequest(priority = false, category = 'background') {
    this.resetAdaptiveMode();
    // Check 2-minute budget first
    if (!this.canConsumeBudget(category)) {
      return false;
    }
    
    const now = Date.now();
    
    // Reset global counter if window has passed
    if ((now - this.globalLastReset) >= this.globalWindow) {
      this.globalRequestCount = 0;
      this.globalPriorityUsed = 0;
      this.globalLastReset = now;
    }

    const available = this.globalLimit - this.globalRequestCount;
    if (priority) {
      return available > 0;
    }
    const reserved = this.getReservedTokens(this.globalLimit);
    const reserveRemaining = Math.max(reserved - this.globalPriorityUsed, 0);
    return available > reserveRemaining;
  }

  /**
   * Record global request
   */
  recordGlobalRequest(priority = false, category = 'background') {
    this.globalRequestCount++;
    if (priority) {
      this.globalPriorityUsed++;
    }
    // 2-minute budget accounting
    this.recordBudget(category);

    // Shared 10s global usage in Redis
    const now = Date.now();
    const winStart = this.getWindowStart(now, this.globalWindow);
    const globalKey = `rl:global:${winStart}`;
    this.incrWithTtl(globalKey, this.globalWindow);
    // Totals for monitoring
    if (typeof global !== 'undefined') {
      global.m_api_requests_total = (global.m_api_requests_total || 0) + 1;
    }
  }

  /**
   * Check if we can make a mastery request
   */
  canMakeMasteryRequest(priority = false, category = 'background') {
    // First check global limit
    if (!this.canMakeGlobalRequest(priority, category)) {
      return false;
    }
    
    const now = Date.now();
    
    // Reset counter if window has passed
    if ((now - this.masteryLastReset) >= this.masteryWindow) {
      this.masteryRequestCount = 0;
      this.masteryPriorityUsed = 0;
      this.masteryLastReset = now;
    }

    const available = this.masteryLimit - this.masteryRequestCount;
    if (priority) {
      return available > 0;
    }
    const reserved = this.getReservedTokens(this.masteryLimit);
    const reserveRemaining = Math.max(reserved - this.masteryPriorityUsed, 0);
    return available > reserveRemaining;
  }

  /**
   * Record a mastery request
   */
  recordMasteryRequest(priority = false, category = 'background') {
    // Record global request first
    this.recordGlobalRequest(priority, category);
    this.masteryRequestCount++;
    if (priority) {
      this.masteryPriorityUsed++;
    }
    // Shared 10s mastery endpoint usage in Redis
    const now = Date.now();
    const winStart = this.getWindowStart(now, this.masteryWindow);
    const masteryKey = `rl:mastery:${winStart}`;
    this.incrWithTtl(masteryKey, this.masteryWindow);
    if (typeof global !== 'undefined') {
      global.m_api_mastery_requests_total = (global.m_api_mastery_requests_total || 0) + 1;
      if (priority) {
        global.m_api_mastery_requests_priority_total = (global.m_api_mastery_requests_priority_total || 0) + 1;
      } else {
        global.m_api_mastery_requests_normal_total = (global.m_api_mastery_requests_normal_total || 0) + 1;
      }
    }
  }

  // Expose shared counters (aggregated) for /metrics
  async getBudgetRateLimitStatus() {
    const now = Date.now();
    const winStart = this.getWindowStart(now, this.budgetWindow);
    const totalKey = `rl:budget:${winStart}:total`;
    const byCat = {
      discovery: `rl:budget:${winStart}:discovery`,
      priorityRescan: `rl:budget:${winStart}:priorityRescan`,
      staleRescan: `rl:budget:${winStart}:staleRescan`,
      background: `rl:budget:${winStart}:background`
    };
    const [total, d, p, s, b] = await Promise.all([
      this.getInt(totalKey),
      this.getInt(byCat.discovery),
      this.getInt(byCat.priorityRescan),
      this.getInt(byCat.staleRescan),
      this.getInt(byCat.background)
    ]);
    return {
      usedTotal: total ?? this.budgetUsedTotal,
      limitTotal: this.budgetLimit,
      windowMs: this.budgetWindow,
      usedByCategory: {
        discovery: d ?? this.budgetUsed.discovery,
        priorityRescan: p ?? this.budgetUsed.priorityRescan,
        staleRescan: s ?? this.budgetUsed.staleRescan,
        background: b ?? this.budgetUsed.background
      }
    };
  }

  async getGlobal10sSharedUsage() {
    const now = Date.now();
    const winStart = this.getWindowStart(now, this.globalWindow);
    const key = `rl:global:${winStart}`;
    const v = await this.getInt(key);
    return {
      used: v ?? this.globalRequestCount,
      limit: this.globalLimit,
      windowMs: this.globalWindow
    };
  }

  async getMastery10sSharedUsage() {
    const now = Date.now();
    const winStart = this.getWindowStart(now, this.masteryWindow);
    const key = `rl:mastery:${winStart}`;
    const v = await this.getInt(key);
    return {
      used: v ?? this.masteryRequestCount,
      limit: this.masteryLimit,
      windowMs: this.masteryWindow
    };
  }

  /**
   * Optimized wait function with exponential backoff
   */
  async waitForRateLimit() {
    const now = Date.now();
    const masteryWaitTime = Math.max(0, this.masteryWindow - (now - this.masteryLastReset));
    const globalWaitTime = Math.max(0, this.globalWindow - (now - this.globalLastReset));
    const waitTime = Math.max(masteryWaitTime, globalWaitTime);
    
    if (waitTime > 0) {
      // Add small buffer and apply adaptive backoff
      const adjustedWaitTime = (waitTime + 100) * this.backoffMultiplier;
      this.logRateLimitThrottled(Math.ceil(adjustedWaitTime / 1000));
      await new Promise(resolve => setTimeout(resolve, adjustedWaitTime));
      
      // Reset counters after waiting
      this.masteryRequestCount = 0;
      this.masteryLastReset = Date.now();
      this.globalRequestCount = 0;
      this.globalLastReset = Date.now();
      this.masteryPriorityUsed = 0;
      this.globalPriorityUsed = 0;
    }
  }

  /**
   * Get mastery rate limit status
   */
  getMasteryRateLimitStatus() {
    const now = Date.now();
    const timeSinceReset = now - this.masteryLastReset;
    const resetIn = Math.max(0, this.masteryWindow - timeSinceReset);
    
    return {
      current: this.masteryRequestCount,
      limit: this.masteryLimit,
      remaining: Math.max(0, this.masteryLimit - this.masteryRequestCount),
      resetIn,
      adaptiveMode: this.adaptiveMode,
      backoffMultiplier: this.backoffMultiplier
    };
  }

  /**
   * Get global rate limit status
   */
  getGlobalRateLimitStatus() {
    const now = Date.now();
    const timeSinceReset = now - this.globalLastReset;
    const resetIn = Math.max(0, this.globalWindow - timeSinceReset);
    
    return {
      current: this.globalRequestCount,
      limit: this.globalLimit,
      remaining: Math.max(0, this.globalLimit - this.globalRequestCount),
      resetIn,
      adaptiveMode: this.adaptiveMode,
      backoffMultiplier: this.backoffMultiplier
    };
  }
}

module.exports = RateLimiter; 