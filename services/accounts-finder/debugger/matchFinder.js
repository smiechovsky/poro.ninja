const { logL } = require('./config');

// Service startup and general logs
function logServiceStart() {
  logL('ACCOUNTS-FINDER', 0, '🚀 Starting Accounts Finder service...');
}

function logServiceStarted() {
  logL('ACCOUNTS-FINDER', 0, '✅ Accounts Finder service started successfully');
}

function logDatabaseConnection() {
  logL('ACCOUNTS-FINDER', 0, '✅ Database connection successful');
}

function logInitialAccountCount(count) {
  logL('ACCOUNTS-FINDER', 0, `📊 Starting with ${count} accounts in database`);
}

// Loop-related logs
function logLoopStart(loopNumber) {
  logL('ACCOUNTS-FINDER', 1, `🔄 Starting loop #${loopNumber}`);
}

function logLoopEnd(loopNumber, uniqueFound, duplicates, totalCount) {
  logL('ACCOUNTS-FINDER', 1, `✅ Loop #${loopNumber} completed: ${uniqueFound} unique, ${duplicates} duplicates (${totalCount} total accounts)`);
}

function logLoopSummary(uniqueFound, duplicates, totalProcessed) {
  logL('ACCOUNTS-FINDER', 1, `📊 Loop summary: ${uniqueFound} unique, ${duplicates} duplicates from ${totalProcessed} processed accounts`);
}

function logWaitingForNextLoop(seconds) {
  logL('ACCOUNTS-FINDER', 1, `⏰ Waiting ${seconds} seconds before next loop...`);
}

function logLoopProgress(loopNumber, totalCount) {
  logL('ACCOUNTS-FINDER', 1, `📊 Starting loop #${loopNumber} with ${totalCount} accounts to process`);
}

// Processing logs
function logProcessingAccount(nickname, tag) {
  logL('ACCOUNTS-FINDER', 2, `👤 Processing account: ${nickname}#${tag}`);
}

function logFetchingMatches(nickname, tag, count) {
  logL('ACCOUNTS-FINDER', 2, `🎮 Fetching ${count} matches for ${nickname}#${tag}`);
}

function logMatchesFound(nickname, tag, matchCount) {
  logL('ACCOUNTS-FINDER', 2, `✅ Found ${matchCount} matches for ${nickname}#${tag}`);
}

function logProcessingMatch(matchId) {
  logL('ACCOUNTS-FINDER', 2, `🎯 Processing match: ${matchId}`);
}

function logFetchingMatchDetails(matchId) {
  logL('ACCOUNTS-FINDER', 2, `🔍 Fetching details for match: ${matchId}`);
}

function logMatchParticipants(matchId, participantCount) {
  logL('ACCOUNTS-FINDER', 2, `👥 Found ${participantCount} participants in match: ${matchId}`);
}

function logProcessingParticipant(puuid) {
  logL('ACCOUNTS-FINDER', 2, `👤 Processing participant: ${puuid}`);
}

function logFetchingAccountInfo(puuid) {
  logL('ACCOUNTS-FINDER', 2, `🔍 Fetching account info for: ${puuid}`);
}

function logAccountFound(nickname, tag) {
  logL('ACCOUNTS-FINDER', 2, `✅ Account found: ${nickname}#${tag}`);
}

function logAccountExists(nickname, tag) {
  logL('ACCOUNTS-FINDER', 2, `⏭️ Account already exists: ${nickname}#${tag}`);
}

function logAccountAdded(nickname, tag) {
  logL('ACCOUNTS-FINDER', 2, `➕ New account added: ${nickname}#${tag}`);
}

// Error logs
function logDbError(context, error) {
  logL('ACCOUNTS-FINDER', 0, `❌ Database error in ${context}:`, error.message);
}

function logGeneralError(context, error) {
  logL('ACCOUNTS-FINDER', 0, `❌ Error in ${context}:`, error.message);
}

// Rate limiting logs - moved to level 2
function logRateLimitStatus(status) {
  logL('ACCOUNTS-FINDER', 2, `📊 Rate limit status:`, status);
}

function logRateLimitReached(endpoint, retryAfter) {
  logL('ACCOUNTS-FINDER', 1, `⏰ Rate limit exceeded for ${endpoint}, waiting ${retryAfter} seconds before retry...`);
}

function logRateLimitProgress(processedAccounts, totalAccounts, remainingAccounts, estimatedMinutes, retryAfter) {
  logL('ACCOUNTS-FINDER', 1, `⏰ Rate limit reached! Progress: ${processedAccounts}/${totalAccounts} accounts processed`);
  logL('ACCOUNTS-FINDER', 1, `📊 Remaining: ${remainingAccounts} accounts`);
  logL('ACCOUNTS-FINDER', 1, `⏱️ Estimated time remaining: ${estimatedMinutes} minutes`);
  logL('ACCOUNTS-FINDER', 1, `🔄 Waiting ${retryAfter} seconds before continuing...`);
}

// New improved rate limiting logs
function logRateLimitReachedForMatches(processedAccounts, totalAccounts, remainingAccounts, retryAfter) {
  logL('ACCOUNTS-FINDER', 1, `⏰ RATE LIMIT: getMatchDetails endpoint exhausted`);
  logL('ACCOUNTS-FINDER', 1, `📊 Progress: ${processedAccounts}/${totalAccounts} accounts processed (${remainingAccounts} remaining)`);
  logL('ACCOUNTS-FINDER', 1, `🔄 Waiting ${retryAfter} seconds before continuing...`);
}

function logRateLimitReachedForAccounts(processedAccounts, totalAccounts, remainingAccounts, retryAfter) {
  logL('ACCOUNTS-FINDER', 1, `⏰ RATE LIMIT: getAccountInfo endpoint exhausted`);
  logL('ACCOUNTS-FINDER', 1, `📊 Progress: ${processedAccounts}/${totalAccounts} accounts processed (${remainingAccounts} remaining)`);
  logL('ACCOUNTS-FINDER', 1, `🔄 Waiting ${retryAfter} seconds before continuing...`);
}

function logRateLimitReachedForMatchIds(processedAccounts, totalAccounts, remainingAccounts, retryAfter) {
  logL('ACCOUNTS-FINDER', 1, `⏰ RATE LIMIT: getMatchIds endpoint exhausted`);
  logL('ACCOUNTS-FINDER', 1, `📊 Progress: ${processedAccounts}/${totalAccounts} accounts processed (${remainingAccounts} remaining)`);
  logL('ACCOUNTS-FINDER', 1, `🔄 Waiting ${retryAfter} seconds before continuing...`);
}

// Progress and statistics logs
function logProgressEstimation(elapsedMinutes, progressPercentage, estimatedTotalMinutes) {
  logL('ACCOUNTS-FINDER', 1, `📊 Progress: ${progressPercentage.toFixed(1)}% (${elapsedMinutes.toFixed(1)}/${estimatedTotalMinutes.toFixed(1)} minutes)`);
}

function logFinalSummary(elapsedMinutes, processedAccounts, totalAccounts, processedMatches, totalMatches, totalParticipants, newAccountsFound, existingAccountsFound, failedParticipants, uniqueFound, duplicates) {
  logL('ACCOUNTS-FINDER', 1, `\n📊 FINAL SUMMARY:`);
  logL('ACCOUNTS-FINDER', 1, `⏱️ Total time: ${Math.round(elapsedMinutes)} minutes`);
  logL('ACCOUNTS-FINDER', 1, `👤 Accounts processed: ${processedAccounts}/${totalAccounts}`);
  logL('ACCOUNTS-FINDER', 1, `🎮 Matches processed: ${processedMatches}/${totalMatches}`);
  logL('ACCOUNTS-FINDER', 1, `👥 Total participants found: ${totalParticipants}`);
  logL('ACCOUNTS-FINDER', 1, `✅ New accounts added: ${newAccountsFound}`);
  logL('ACCOUNTS-FINDER', 1, `⏭️ Existing accounts found: ${existingAccountsFound}`);
  logL('ACCOUNTS-FINDER', 1, `❌ Failed participants: ${failedParticipants}`);
  logL('ACCOUNTS-FINDER', 1, `📈 Success rate: ${totalParticipants > 0 ? Math.round((newAccountsFound + existingAccountsFound) / totalParticipants * 100) : 0}%`);
  logL('ACCOUNTS-FINDER', 1, `🎯 Final results: ${uniqueFound} unique, ${duplicates} duplicates`);
}

function logRateLimiterStatistics(rateLimitStats, elapsedMinutes) {
  logL('ACCOUNTS-FINDER', 1, `\n⏳ RATE LIMITER STATISTICS:`);
  logL('ACCOUNTS-FINDER', 1, `🔄 Total rate limit waits: ${rateLimitStats.totalWaits}`);
  logL('ACCOUNTS-FINDER', 1, `⏰ Total wait time: ${Math.round(rateLimitStats.totalWaitTime / 1000)} seconds (${Math.round(rateLimitStats.totalWaitTime / 60000)} minutes)`);
  logL('ACCOUNTS-FINDER', 1, `📊 Average wait time: ${Math.round(rateLimitStats.averageWaitTime / 1000)} seconds`);
  logL('ACCOUNTS-FINDER', 1, `🚀 Active processing time: ${Math.round((elapsedMinutes * 60 - rateLimitStats.totalWaitTime / 1000) / 60)} minutes`);
  logL('ACCOUNTS-FINDER', 1, `📈 Processing efficiency: ${elapsedMinutes > 0 ? Math.round(((elapsedMinutes * 60 - rateLimitStats.totalWaitTime / 1000) / (elapsedMinutes * 60)) * 100) : 0}%\n`);
}

function logWaitingForRetry() {
  logL('ACCOUNTS-FINDER', 1, '⏰ Waiting 60 seconds before retrying...');
}

function logShutdown() {
  logL('ACCOUNTS-FINDER', 0, '\n🛑 Shutting down Accounts Finder service...');
}

function logApiKeyMissing() {
  logL('ACCOUNTS-FINDER', 0, '❌ API_KEY environment variable is required');
}

function logAccountProcessingError(nickname, tag, error) {
  logL('ACCOUNTS-FINDER', 0, `❌ Error processing account ${nickname}#${tag}:`, error.message);
}

function logMatchProcessingError(matchId, error) {
  logL('ACCOUNTS-FINDER', 0, `❌ Error processing match ${matchId}:`, error.message);
}

function logMatchFetchingError(nickname, tag, error) {
  logL('ACCOUNTS-FINDER', 0, `❌ Error fetching matches for ${nickname}#${tag}:`, error.message);
}

function logParticipantProcessingError(puuid, error) {
  logL('ACCOUNTS-FINDER', 0, `❌ Error processing participant ${puuid}:`, error.message);
}

function logMatchDetailsError(matchId, error) {
  logL('ACCOUNTS-FINDER', 0, `❌ Error fetching match details for ${matchId}:`, error.message);
}

function logCurrentProgressDetails(progressPercentage, elapsedMinutes, estimatedTotalMinutes, processedAccounts, totalAccounts, processedMatches, totalMatches, uniqueFound, duplicates, failedParticipants, estimatedRemainingMinutes) {
  logL('ACCOUNTS-FINDER', 1, `📊 Progress: ${progressPercentage.toFixed(1)}% (${elapsedMinutes.toFixed(1)}/${estimatedTotalMinutes.toFixed(1)} minutes)`);
  logL('ACCOUNTS-FINDER', 1, `👤 Accounts: ${processedAccounts}/${totalAccounts} | 🎮 Matches: ${processedMatches}/${totalMatches}`);
  logL('ACCOUNTS-FINDER', 1, `✅ New: ${uniqueFound} | ⏭️ Duplicates: ${duplicates} | ❌ Failed: ${failedParticipants}`);
  logL('ACCOUNTS-FINDER', 1, `⏱️ Estimated time remaining: ${estimatedRemainingMinutes} minutes\n`);
}

function logMatchAlreadyScanned(matchId) {
  logL('ACCOUNTS-FINDER', 2, `⏭️ Match already scanned: ${matchId}`);
}

module.exports = {
  logServiceStart,
  logServiceStarted,
  logDatabaseConnection,
  logInitialAccountCount,
  logLoopStart,
  logLoopEnd,
  logLoopSummary,
  logWaitingForNextLoop,
  logLoopProgress,
  logProcessingAccount,
  logFetchingMatches,
  logMatchesFound,
  logProcessingMatch,
  logFetchingMatchDetails,
  logMatchParticipants,
  logProcessingParticipant,
  logFetchingAccountInfo,
  logAccountFound,
  logAccountExists,
  logAccountAdded,
  logDbError,
  logGeneralError,
  logRateLimitStatus,
  logRateLimitReached,
  logRateLimitProgress,
  logRateLimitReachedForMatches,
  logRateLimitReachedForAccounts,
  logRateLimitReachedForMatchIds,
  logProgressEstimation,
  logFinalSummary,
  logRateLimiterStatistics,
  logWaitingForRetry,
  logShutdown,
  logApiKeyMissing,
  logAccountProcessingError,
  logMatchProcessingError,
  logMatchFetchingError,
  logParticipantProcessingError,
  logMatchDetailsError,
  logCurrentProgressDetails,
  logMatchAlreadyScanned
}; 