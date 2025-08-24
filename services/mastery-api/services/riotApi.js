const axios = require('axios');
const RateLimiter = require('../utils/rateLimiter');
const ApiRequestHandler = require('../utils/apiRequestHandler');
const { 
  logUserFetch, 
  logUserFetchSuccess, 
  logMasteryFetch, 
  logMasteryFetchSuccess
} = require('../debugger/api');

class RiotApi {
  constructor(apiKey) {
    this.key = apiKey;
    this.rateLimiter = new RateLimiter();
    this.requestHandler = new ApiRequestHandler(this.rateLimiter);
  }

  /**
   * Fetch user data from Riot API
   */
  async fetchUser(continent, nickname, tag) {
    logUserFetch(nickname, tag, continent);
    
    return this.requestHandler.makeRateLimitedRequest(async () => {
      const url = `https://${continent}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${nickname}/${tag}?api_key=${this.key}`;
      const res = await axios.get(url);
      logUserFetchSuccess(nickname, tag);
      return res.data;
    }, { priority: false, category: 'discovery' });
  }

  /**
   * Fetch mastery data from Riot API
   */
  async fetchMastery(region, puuid) {
    logMasteryFetch(region);
    
    await this.requestHandler.prepareRequest(false, 'staleRescan');
    
    return this.requestHandler.makeRateLimitedRequest(async () => {
      const url = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}?api_key=${this.key}`;
      const res = await axios.get(url);
      logMasteryFetchSuccess(res.data.length);
      return res.data;
    }, { priority: false, category: 'staleRescan' });
  }

  /**
   * Fetch champion mastery data from Riot API
   */
  async fetchChampionMastery(region, puuid, priority = false) {
    const category = priority ? 'priorityRescan' : 'staleRescan';
    await this.requestHandler.prepareRequest(priority, category);
    
    return this.requestHandler.makeRateLimitedRequest(async () => {
      const url = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}?api_key=${this.key}`;
      const res = await axios.get(url, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return res.data;
    }, { priority, category });
  }

  /**
   * Get mastery rate limit status
   */
  getMasteryRateLimitStatus() {
    return this.rateLimiter.getMasteryRateLimitStatus();
  }

  /**
   * Get global rate limit status
   */
  getGlobalRateLimitStatus() {
    return this.rateLimiter.getGlobalRateLimitStatus();
  }

  /**
   * Get rate limit log throttle setting
   */
  get rateLimitLogThrottle() {
    return this.rateLimiter.rateLimitLogThrottle;
  }

  /**
   * Set rate limit log throttle setting
   */
  set rateLimitLogThrottle(value) {
    this.rateLimiter.rateLimitLogThrottle = value;
  }
}

module.exports = RiotApi;