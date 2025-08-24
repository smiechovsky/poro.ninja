const { logL } = require('./config');

// API-related logging functions
function logUserFetch(nickname, tag, continent) {
  logL('API', 2, `🔍 Fetching user data for ${nickname}#${tag} from ${continent}`);
}

function logUserFetchSuccess(nickname, tag) {
  logL('API', 2, `✅ User data fetched successfully for ${nickname}#${tag}`);
}

function logMasteryFetch(region) {
  logL('API', 2, `🔍 Fetching mastery data from ${region}`);
}

function logMasteryFetchSuccess(masteryCount) {
  logL('API', 2, `✅ Mastery data fetched successfully, ${masteryCount} champions found`);
}

function logApiError(context, error) {
  logL('API', 0, `❌ API error during ${context}:`, error.message);
}

function logRateLimitRetry(retryAfter) {
  logL('API', 1, `🔄 Rate limit exceeded, waiting ${retryAfter} seconds before retry...`);
}

function logAddAccountRequest(nickname, tag) {
  logL('API', 1, `📝 Adding account: ${nickname}#${tag}`);
}

function logAddAccountSuccess(nickname, tag) {
  logL('API', 1, `✅ Account added successfully: ${nickname}#${tag}`);
}

function logAddAccountExists(nickname, tag) {
  logL('API', 1, `ℹ️ Account already exists: ${nickname}#${tag}`);
}

function logAddAccountNotFound(nickname, tag) {
  logL('API', 0, `❌ Account not found: ${nickname}#${tag}`);
}

function logForcedSyncStart(nickname, tag) {
  if (nickname && tag) {
    logL('API', 1, `🔄 Starting forced sync for: ${nickname}#${tag}`);
  } else {
    logL('API', 1, '🔄 Starting forced sync for ALL accounts');
  }
}

function logForcedSyncComplete(nickname, tag, result) {
  if (nickname && tag) {
    const newEntries = typeof result === 'number' ? result : (result?.newEntries ?? 0);
    logL('API', 1, `✅ Forced sync completed for ${nickname}#${tag}, ${newEntries} new entries`);
  } else {
    const processed = result?.processedCount ?? 0;
    const added = result?.totalNewEntries ?? 0;
    logL('API', 1, `✅ Forced sync for ALL accounts completed: processed=${processed}, newEntries=${added}`);
  }
}

function logChampionsUpdateStart() {
  logL('API', 2, '🔄 Starting champions update...');
}

function logChampionsUpdateVersion(version) {
  logL('API', 2, `📋 Champions version: ${version}`);
}

function logChampionsUpdateSuccess(championsCount) {
  logL('API', 2, `✅ Champions updated successfully, ${championsCount} champions`);
}

function logChampionsUpdateComplete() {
  logL('API', 2, '✅ Champions update completed');
}

module.exports = {
  logUserFetch,
  logUserFetchSuccess,
  logMasteryFetch,
  logMasteryFetchSuccess,
  logApiError,
  logRateLimitRetry,
  logAddAccountRequest,
  logAddAccountSuccess,
  logAddAccountExists,
  logAddAccountNotFound,
  logForcedSyncStart,
  logForcedSyncComplete,
  logChampionsUpdateStart,
  logChampionsUpdateVersion,
  logChampionsUpdateSuccess,
  logChampionsUpdateComplete
}; 