const axios = require('axios');
const RateLimiter = require('./rateLimiter');
const { 
  logRateLimitReached, 
  logRateLimitStatus,
  logRateLimitReachedForMatches,
  logRateLimitReachedForAccounts,
  logRateLimitReachedForMatchIds
} = require('../debugger/matchFinder');

class RiotApi {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.rateLimiter = new RateLimiter();
    
    this.baseUrls = {
      europe: 'https://europe.api.riotgames.com',
      americas: 'https://americas.api.riotgames.com',
      asia: 'https://asia.api.riotgames.com',
      sea: 'https://sea.api.riotgames.com'
    };
  }

  /**
   * Make a rate-limited API request
   * @param {string} endpoint - Endpoint name for rate limiting
   * @param {Function} requestFn - Function that makes the actual request
   * @param {Object} progressInfo - Optional progress information for logging
   * @returns {Promise<any>} - API response
   */
  async makeRateLimitedRequest(endpoint, requestFn, progressInfo = null) {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      await this.rateLimiter.waitIfNeeded(endpoint);
      
      try {
        const response = await requestFn();
        this.rateLimiter.recordRequest(endpoint);
        
        // Add shorter delay to improve throughput
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms
        
        return response;
      } catch (error) {
        if (error.response?.status === 429) {
          retryCount++;
          
          if (retryCount > maxRetries) {
            throw error; // Give up after max retries
          }
          
          // Rate limit exceeded, wait with exponential backoff
          const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
          const backoffTime = retryAfter * Math.pow(2, retryCount - 1); // Exponential backoff
          const minWait = Math.max(backoffTime, 30); // Minimum 30 seconds
          
          // Use specific logging based on endpoint and progress info
          if (progressInfo) {
            const { processedAccounts, totalAccounts, remainingAccounts } = progressInfo;
            
            switch (endpoint) {
              case 'getMatchDetails':
                logRateLimitReachedForMatches(processedAccounts, totalAccounts, remainingAccounts, minWait);
                break;
              case 'getAccountInfo':
                logRateLimitReachedForAccounts(processedAccounts, totalAccounts, remainingAccounts, minWait);
                break;
              case 'getMatchIds':
                logRateLimitReachedForMatchIds(processedAccounts, totalAccounts, remainingAccounts, minWait);
                break;
              default:
                logRateLimitReached(endpoint, minWait);
            }
          } else {
            logRateLimitReached(endpoint, minWait);
          }
          
          // Log rate limit status
          const status = this.rateLimiter.getStatus();
          logRateLimitStatus(status);
          
          await new Promise(resolve => setTimeout(resolve, minWait * 1000));
          
          // Reset rate limiter for this endpoint more thoroughly
          this.rateLimiter.requestCounts[endpoint] = 0;
          this.rateLimiter.lastReset[endpoint] = Date.now();
          
          // Add extra delay after 429 to be safe
          await new Promise(resolve => setTimeout(resolve, 5000)); // Increased from 2000ms
          
          // Continue to retry
          continue;
        }
        
        throw error; // Non-429 errors are thrown immediately
      }
    }
  }

  /**
   * Get match IDs for a player
   * @param {string} continent - API continent (europe, americas, asia, sea)
   * @param {string} puuid - Player's PUUID
   * @param {number} start - Start index (default: 0)
   * @param {number} count - Number of matches to fetch (default: 100)
   * @param {Object} progressInfo - Optional progress information for logging
   * @returns {Promise<Array>} Array of match IDs
   */
  async getMatchIds(continent, puuid, start = 0, count = 100, progressInfo = null) {
    return this.makeRateLimitedRequest('getMatchIds', async () => {
      const url = `${this.baseUrls[continent]}/lol/match/v5/matches/by-puuid/${puuid}/ids`;
      const response = await axios.get(url, {
        params: {
          start,
          count,
          api_key: this.apiKey
        },
        timeout: 10000
      });
      return response.data;
    }, progressInfo);
  }

  /**
   * Get match details by match ID
   * @param {string} continent - API continent
   * @param {string} matchId - Match ID
   * @param {Object} progressInfo - Optional progress information for logging
   * @returns {Promise<Object>} Match details
   */
  async getMatchDetails(continent, matchId, progressInfo = null) {
    return this.makeRateLimitedRequest('getMatchDetails', async () => {
      const url = `${this.baseUrls[continent]}/lol/match/v5/matches/${matchId}`;
      const response = await axios.get(url, {
        params: {
          api_key: this.apiKey
        },
        timeout: 15000
      });
      return response.data;
    }, progressInfo);
  }

  /**
   * Get account info by PUUID
   * @param {string} continent - API continent
   * @param {string} puuid - Player's PUUID
   * @param {Object} progressInfo - Optional progress information for logging
   * @returns {Promise<Object>} Account info with gameName and tagLine
   */
  async getAccountInfo(continent, puuid, progressInfo = null) {
    return this.makeRateLimitedRequest('getAccountInfo', async () => {
      const url = `${this.baseUrls[continent]}/riot/account/v1/accounts/by-puuid/${puuid}`;
      const response = await axios.get(url, {
        params: {
          api_key: this.apiKey
        },
        timeout: 10000
      });
      return response.data;
    }, progressInfo);
  }

  /**
   * Convert region to continent for API calls
   * @param {string} region - Game region (eun1, euw1, na1, etc.)
   * @returns {string} API continent (europe, americas, asia, sea)
   */
  regionToContinent(region) {
    const regionMap = {
      'eun1': 'europe',
      'euw1': 'europe',
      'tr1': 'europe',
      'ru': 'europe',
      'na1': 'americas',
      'br1': 'americas',
      'la1': 'americas',
      'la2': 'americas',
      'kr': 'asia',
      'jp1': 'asia',
      'oc1': 'sea',
      'ph2': 'sea',
      'sg2': 'sea',
      'th2': 'sea',
      'tw2': 'sea',
      'vn2': 'sea'
    };
    
    return regionMap[region.toLowerCase()] || 'europe';
  }

  /**
   * Get current rate limit status for all endpoints
   * @returns {Object} Rate limit status for each endpoint
   */
  getRateLimitStatus() {
    return this.rateLimiter.getStatus();
  }
}

module.exports = RiotApi;