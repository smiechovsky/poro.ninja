const { logL, isDetailedDebugEnabled } = require('./config');

const OVERVIEW_PREFIX = 'OVERVIEW';

function logAccountFromDb() {
  if (isDetailedDebugEnabled()) {
    logL(OVERVIEW_PREFIX, 2, 'Account loaded from DB.');
  }
}

function logAccountNotFound(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `🔍 Account not found in DB: ${nickname}#${tag} (${region})`);
}

function logAutoAddAccountStart(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `🔄 Starting automatic account addition for ${nickname}#${tag} (${region})`);
}

function logAutoAddAccountSuccess(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `✅ Automatic account addition successful for ${nickname}#${tag} (${region})`);
}

function logAutoAddAccountError(nickname, tag, region, error) {
  logL(OVERVIEW_PREFIX, 2, `❌ Automatic account addition failed for ${nickname}#${tag} (${region}): ${error}`);
}

function logHistoryAccountNotFound(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `🔍 History: Account not found in DB: ${nickname}#${tag} (${region})`);
}

function logHistoryAutoAddAccountStart(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `🔄 History: Starting automatic account addition for ${nickname}#${tag} (${region})`);
}

function logHistoryAutoAddAccountSuccess(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `✅ History: Automatic account addition successful for ${nickname}#${tag} (${region})`);
}

function logHistoryAutoAddAccountError(nickname, tag, region, error) {
  logL(OVERVIEW_PREFIX, 2, `❌ History: Automatic account addition failed for ${nickname}#${tag} (${region}): ${error}`);
}

function logChampionOverviewAccountNotFound(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `🔍 ChampionOverview: Account not found in DB: ${nickname}#${tag} (${region})`);
}

function logChampionOverviewAutoAddAccountStart(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `🔄 ChampionOverview: Starting automatic account addition for ${nickname}#${tag} (${region})`);
}

function logChampionOverviewAutoAddAccountSuccess(nickname, tag, region) {
  logL(OVERVIEW_PREFIX, 2, `✅ ChampionOverview: Automatic account addition successful for ${nickname}#${tag} (${region})`);
}

function logChampionOverviewAutoAddAccountError(nickname, tag, region, error) {
  logL(OVERVIEW_PREFIX, 2, `❌ ChampionOverview: Automatic account addition failed for ${nickname}#${tag} (${region}): ${error}`);
}

module.exports = {
  logAccountFromDb,
  logAccountNotFound,
  logAutoAddAccountStart,
  logAutoAddAccountSuccess,
  logAutoAddAccountError,
  logHistoryAccountNotFound,
  logHistoryAutoAddAccountStart,
  logHistoryAutoAddAccountSuccess,
  logHistoryAutoAddAccountError,
  logChampionOverviewAccountNotFound,
  logChampionOverviewAutoAddAccountStart,
  logChampionOverviewAutoAddAccountSuccess,
  logChampionOverviewAutoAddAccountError,
  OVERVIEW_PREFIX
}; 