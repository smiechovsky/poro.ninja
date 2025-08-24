const { logApiError, logRateLimitRetry } = require('../debugger/api');

/**
 * Handles API requests with retry logic and error handling
 */
class ApiRequestHandler {
  constructor(rateLimiter) {
    this.rateLimiter = rateLimiter;
  }

  /**
   * Make a rate-limited API request with retry logic
   */
  async makeRateLimitedRequest(requestFn, options = {}) {
    const { priority = false, category = 'background' } = options;
    let retryCount = 0;
    const maxRetries = 5; // Increased retries
    
    while (retryCount <= maxRetries) {
      try {
        const result = await requestFn();
        this.rateLimiter.trackSuccess(); // Track successful request
        return result;
      } catch (error) {
        // Log error details for debugging
        if (retryCount === 0) {
          logApiError(`API request failed: ${error.message}`, error);
        }
        
        if (error.response?.status === 429) {
          // Handle rate limit error
          this.rateLimiter.handleRateLimitError();
          retryCount++;
          
          if (retryCount > maxRetries) {
            throw error; // Give up after max retries
          }
          
          // Rate limit exceeded, wait with exponential backoff
          const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
          const backoffTime = retryAfter * Math.pow(2, retryCount - 1); // Exponential backoff
          const minWait = Math.max(backoffTime, 30); // Minimum 30 seconds
          
          this.rateLimiter.logRateLimitThrottled(minWait);
          await new Promise(resolve => setTimeout(resolve, minWait * 1000));
          
          // Continue to retry
          continue;
        } else if (error.response?.status === 504 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          // Handle timeout errors
          this.rateLimiter.handleTimeoutError();
          retryCount++;
          
          if (retryCount > maxRetries) {
            throw error; // Give up after max retries
          }
          
          // Wait with exponential backoff for timeouts
          const backoffTime = Math.pow(2, retryCount) * 5; // 10, 20, 40, 80, 160 seconds
          const minWait = Math.max(backoffTime, 10); // Minimum 10 seconds
          
          this.rateLimiter.logRateLimitThrottled(minWait);
          await new Promise(resolve => setTimeout(resolve, minWait * 1000));
          
          // Continue to retry
          continue;
        }
        throw error; // Other errors are thrown immediately
      }
    }
  }

  /**
   * Prepare request with rate limiting
   */
  async prepareRequest(priority = false, category = 'background') {
    // Check global and mastery rate limits
    if (!this.rateLimiter.canMakeMasteryRequest(priority)) {
      await this.rateLimiter.waitForRateLimit();
    }
    
    this.rateLimiter.recordMasteryRequest(priority, category);
  }
}

module.exports = ApiRequestHandler; 