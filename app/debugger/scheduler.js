const { logL, isDebugEnabled } = require('./config');

const SCHEDULER_PREFIX = '[SCHEDULER]';

function logSyncStart(totalAccounts) {
  if (isDebugEnabled()) {
    logL(SCHEDULER_PREFIX, 1, `Startring champion mastert sync for ${totalAccounts} accounts`);
  }
}

function logAccountSyncStart(nickname, tag, region) {
  logL(SCHEDULER_PREFIX, 2, `Startring champion mastert sync for ${nickname}#${tag} (${region})`);
}

function logChampionsFetched(count) {
  logL(SCHEDULER_PREFIX, 2, `Fetched ${count} champions from API`);
}

function logAccountSyncComplete(nickname, tag, region, newEntries) {
  if (newEntries > 0) {
    logL(SCHEDULER_PREFIX, 2, `Champion mastery sync completed for ${nickname}#${tag} (${region}), ${newEntries} new entry founded`);
  } else {
    logL(SCHEDULER_PREFIX, 2, `Champion mastery sync completed for ${nickname}#${tag} (${region}), no new entries founded`);
  }
}

function logSyncComplete(processed, total, totalNewEntries) {
  if (isDebugEnabled()) {
    logL(SCHEDULER_PREFIX, 1, `Champion mastery sync completed for ${processed} of ${total} accounts`);
    
    if (totalNewEntries > 0) {
      logL(SCHEDULER_PREFIX, 1, `Champion mastery sync completed, ${totalNewEntries} new entry founded`);
    } else {
      logL(SCHEDULER_PREFIX, 1, `Champion mastery sync completed, no new entries founded`);
    }
  }
}

function logNextSyncTime(nextTime) {
  if (isDebugEnabled()) {
    logL(SCHEDULER_PREFIX, 1, `Next scan scheduled at ${nextTime}`);
  }
}

module.exports = {
  logSyncStart,
  logAccountSyncStart,
  logChampionsFetched,
  logAccountSyncComplete,
  logSyncComplete,
  logNextSyncTime,
  SCHEDULER_PREFIX
}; 