const { logL, isDetailedDebugEnabled } = require('./config');

const OVERVIEW_PREFIX = '[OVERVIEW]';

function logAccountFromDb() {
  if (isDetailedDebugEnabled()) {
    logL(OVERVIEW_PREFIX, 2, 'Account loaded from DB.');
  }
}

function logAccountFromApi() {
  if (isDetailedDebugEnabled()) {
    logL(OVERVIEW_PREFIX, 2, 'Account not found in DB, fetching from API...');
  }
}

function logAccountFetchedFromApi() {
  if (isDetailedDebugEnabled()) {
    logL(OVERVIEW_PREFIX, 2, 'Account fetched from API.');
  }
}

module.exports = {
  logAccountFromDb,
  logAccountFromApi,
  logAccountFetchedFromApi,
  OVERVIEW_PREFIX
}; 