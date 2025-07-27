const axios = require('axios');
const { 
  logUserFetch, 
  logUserFetchSuccess, 
  logMasteryFetch, 
  logMasteryFetchSuccess 
} = require('../debugger/api');

class RiotApi {
  constructor(apiKey) {
    this.key = apiKey;
  }

  async fetchUser(continent, nickname, tag) {
    logUserFetch(nickname, tag, continent);
    const url = `https://${continent}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${nickname}/${tag}?api_key=${this.key}`;
    const res = await axios.get(url);
    logUserFetchSuccess(nickname, tag);
    return res.data;
  }

  async fetchMastery(region, puuid) {
    logMasteryFetch(region);
    const url = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}?api_key=${this.key}`;
    const res = await axios.get(url);
    logMasteryFetchSuccess(res.data.length);
    return res.data;
  }
}

module.exports = RiotApi;