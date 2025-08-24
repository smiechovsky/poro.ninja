const { logLogsLevel } = require('./config');

// Leaderboards debugger functions
function logLeaderboardsRequest(champion = null) {
  if (process.env.LOGS_LEVEL >= 1) {
    const championText = champion ? ` for ${champion}` : '';
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:1] Request received${championText}`);
  }
}

function logLeaderboardsQuery(queryType, champion = null) {
  if (process.env.LOGS_LEVEL >= 2) {
    const championText = champion ? ` for ${champion}` : '';
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:2] Executing ${queryType} query${championText}`);
  }
}

function logLeaderboardsResults(count, champion = null) {
  if (process.env.LOGS_LEVEL >= 1) {
    const championText = champion ? ` for ${champion}` : '';
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:1] Retrieved ${count} results${championText}`);
  }
}

function logLeaderboardsSearch(searchTerm, champion) {
  if (process.env.LOGS_LEVEL >= 2) {
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:2] Searching for ${searchTerm} in ${champion} leaderboard`);
  }
}

function logLeaderboardsSearchResults(found, searchTerm, champion) {
  if (process.env.LOGS_LEVEL >= 2) {
    const status = found ? 'found' : 'not found';
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:2] Player ${searchTerm} ${status} in ${champion} leaderboard`);
  }
}

function logLeaderboardsError(error, context = '') {
  if (process.env.LOGS_LEVEL >= 0) {
    const contextText = context ? ` (${context})` : '';
    console.error(`[LEADERBOARDS] [LOGS-LEVEL:0] Error${contextText}:`, error.message);
  }
}

function logLeaderboardsStart() {
  if (process.env.LOGS_LEVEL >= 0) {
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:0] Leaderboards service initialized`);
  }
}

function logLeaderboardsCacheEvent(event, message = '', error = null) {
  const level = event === 'hit' || event === 'miss' || event === 'set' ? 2 : 0;
  if (process.env.LOGS_LEVEL >= level) {
    const base = `[LEADERBOARDS] [LOGS-LEVEL:${level}] [CACHE:${event.toUpperCase()}] ${message}`;
    if (error) {
      console.log(base, '-', error.message);
    } else {
      console.log(base);
    }
  }
}

function logLeaderboardsWarmupStart() {
  if (process.env.LOGS_LEVEL >= 1) {
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:1] Cache warmup started`);
  }
}

function logLeaderboardsWarmupDone(itemsCount, durationMs) {
  if (process.env.LOGS_LEVEL >= 1) {
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:1] Cache warmup completed: ${itemsCount} items in ${durationMs}ms`);
  }
}

function logLeaderboardsWarmupError(error) {
  if (process.env.LOGS_LEVEL >= 0) {
    console.error(`[LEADERBOARDS] [LOGS-LEVEL:0] Cache warmup error:`, error.message);
  }
}

function logLeaderboardsRefreshStart() {
  if (process.env.LOGS_LEVEL >= 1) {
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:1] Cache refresh started`);
  }
}

function logLeaderboardsRefreshDone(itemsCount, durationMs) {
  if (process.env.LOGS_LEVEL >= 1) {
    console.log(`[LEADERBOARDS] [LOGS-LEVEL:1] Cache refresh completed: ${itemsCount} items in ${durationMs}ms`);
  }
}

module.exports = {
  logLeaderboardsRequest,
  logLeaderboardsQuery,
  logLeaderboardsResults,
  logLeaderboardsSearch,
  logLeaderboardsSearchResults,
  logLeaderboardsError,
  logLeaderboardsStart,
  logLeaderboardsCacheEvent,
  logLeaderboardsWarmupStart,
  logLeaderboardsWarmupDone,
  logLeaderboardsWarmupError,
  logLeaderboardsRefreshStart,
  logLeaderboardsRefreshDone
}; 