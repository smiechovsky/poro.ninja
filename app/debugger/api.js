const { logL, isDetailedDebugEnabled } = require('./config');

const API_PREFIX = '[API]';

function logUserFetch(nickname, tag, continent) {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, `Fetching user data for ${nickname}#${tag} from ${continent}`);
  }
}

function logUserFetchSuccess(nickname, tag) {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, `User data fetched successfully for ${nickname}#${tag}`);
  }
}

function logMasteryFetch(region) {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, `Fetching mastery data for ${region} region`);
  }
}

function logMasteryFetchSuccess(championCount) {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, `Mastery data fetched successfully (${championCount} champions)`);
  }
}

function logChampionsUpdateStart() {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, 'Starting champions update...');
  }
}

function logChampionsUpdateVersion(version) {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, 'Using Dragon version:', version);
  }
}

function logChampionsUpdateSuccess(championCount) {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, `Fetched ${championCount} champions from Dragon API`);
  }
}

function logChampionsUpdateComplete() {
  if (isDetailedDebugEnabled()) {
    logL(API_PREFIX, 2, 'Champions table updated successfully');
  }
}

module.exports = {
  logUserFetch,
  logUserFetchSuccess,
  logMasteryFetch,
  logMasteryFetchSuccess,
  logChampionsUpdateStart,
  logChampionsUpdateVersion,
  logChampionsUpdateSuccess,
  logChampionsUpdateComplete,
  API_PREFIX
}; 