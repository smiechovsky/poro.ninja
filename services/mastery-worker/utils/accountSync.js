const axios = require('axios');

/**
 * Add account to database and wait for sync completion
 * @param {string} region - Riot region code
 * @param {string} nickname - Player nickname
 * @param {string} tag - Player tag
 * @returns {Promise<Object>} Account data from database
 */
async function addAccountAndWaitForSync(region, nickname, tag) {
  try {
    // Add account via mastery-api
    const response = await axios.post('http://mastery-api:8080/api/add-account', {
      region,
      nickname,
      tag
    }, {
      // Increase timeout to tolerate Riot API backoff on first-time lookups
      timeout: 120000 // 120 seconds
    });

    if (response.data.message === 'Account added and synced successfully') {
      return response.data.account;
    } else if (response.data.message === 'Account already exists') {
      return response.data.account;
    } else if (response.data.message === 'Account added successfully and will be synced by scheduler') {
      // New standardized message from mastery-api
      return response.data.account;
    } else {
      // Be tolerant: if API returned an account payload, use it
      if (response.data && response.data.account) {
        return response.data.account;
      }
      throw new Error('Unexpected response from mastery-api');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Account not found in Riot API. Please check the region, nickname, and tag.');
    }
    throw new Error(`Failed to add account: ${error.message}`);
  }
}

module.exports = {
  addAccountAndWaitForSync
}; 