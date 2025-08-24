const { logL } = require('./config');

const SCHEDULER_PREFIX = 'SCHEDULER';

function formatMinutesHM(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}H ${mins}M`;
}

function logSchedulerStart(accountsCount) {
  logL(SCHEDULER_PREFIX, 1, `🔄 Starting sync for ${accountsCount} accounts`);
}

function logSchedulerComplete(processedCount, totalCount, newEntries, durationMs) {
  const durationMinutes = (durationMs / 60000).toFixed(1);
  logL(SCHEDULER_PREFIX, 1, `✅ Sync completed: ${processedCount}/${totalCount} accounts processed in ${durationMinutes}m | New entries: ${newEntries}`);
}

function logSchedulerError(method, error) {
  logL(SCHEDULER_PREFIX, 0, `❌ ${method} error:`, error.message);
}

function logSkippedAccounts(skippedCount, totalCount) {
  logL(SCHEDULER_PREFIX, 1, `⏭️ Skipped ${skippedCount} accounts (scanned within last 15 minutes)`);
  logL(SCHEDULER_PREFIX, 1, `📊 Total accounts: ${totalCount} | Available for scan: ${totalCount - skippedCount}`);
}

function logSyncErrors(failedCount, totalCount) {
  logL(SCHEDULER_PREFIX, 0, `❌ Sync completed with ${failedCount}/${totalCount} failed accounts`);
}

function logSyncAllAccountsError(error) {
  logL(SCHEDULER_PREFIX, 0, '❌ syncAllAccounts error:', error.message);
}

function logBatchSizeAdjustment(oldSize, newSize, concurrent, reason) {
  logL(SCHEDULER_PREFIX, 1, `⚙️ Batch size adjusted: ${oldSize}→${newSize}, concurrent: ${concurrent} (${reason})`);
}

function logRateLimitWait(accountId, waitTime) {
  logL(SCHEDULER_PREFIX, 1, `⏰ Rate limit (429) - waiting ${waitTime} seconds before retry for ${accountId}`);
}

function logProgress(processedCount, totalCount, elapsedMinutes, estimatedTotal, remaining, newEntries, failedCount) {
  const percentage = ((processedCount / Math.max(totalCount || 1, 1)) * 100).toFixed(1);
  logL(SCHEDULER_PREFIX, 1, `📊 Progress: ${percentage}% (${processedCount}/${totalCount} accounts)`);
  logL(SCHEDULER_PREFIX, 1, `✅ New entries: ${newEntries} | ❌ Failed: ${failedCount}`);
  logL(SCHEDULER_PREFIX, 1, `⏱️ Time passed ${formatMinutesHM(elapsedMinutes)} | Estimated time remaining: ${formatMinutesHM(remaining)}`);
}

function logMemoryUsage(memoryMB) {
  logL(SCHEDULER_PREFIX, 0, `📊 Memory on error: ${memoryMB}MB`);
}

function logContinuousSyncStopped() {
  logL(SCHEDULER_PREFIX, 1, '🛑 Continuous sync stopped');
}

function logPreviousSyncRunning() {
  logL(SCHEDULER_PREFIX, 1, '🔄 Previous sync still running, skipping...');
}

function logContinuousSyncStarted() {
  logL(SCHEDULER_PREFIX, 1, '🔄 Starting continuous sync...');
}

function logContinuousSyncCompleted() {
  logL(SCHEDULER_PREFIX, 1, '✅ Continuous sync completed');
}

function logContinuousSyncError(error) {
  logL(SCHEDULER_PREFIX, 0, '❌ Continuous sync error:', error);
}

function logContinuousSyncModeEnabled() {
  logL(SCHEDULER_PREFIX, 1, '🔄 Continuous sync mode enabled - will scan continuously');
}

function logSyncSchedulingError(error) {
  logL(SCHEDULER_PREFIX, 0, '❌ Sync scheduling error:', error);
}

function logScheduledSyncStarted() {
  logL(SCHEDULER_PREFIX, 1, '🔄 Starting scheduled sync...');
}

function logScheduledSyncCompleted() {
  logL(SCHEDULER_PREFIX, 1, '✅ Scheduled sync completed');
}

function logScheduledSyncError(error) {
  logL(SCHEDULER_PREFIX, 0, '❌ Scheduled sync error:', error);
}

function logUnexpectedTimeout() {
  logL(SCHEDULER_PREFIX, 0, '⚠️ Unexpected timeout in continuous mode');
}

function logLegacyScheduleMethod() {
  logL(SCHEDULER_PREFIX, 1, '⚠️ Legacy schedule method called - using continuous mode instead');
}

function logCurrentProgressDetails(progressPercentage, elapsedMinutes, estimatedTotalMinutes, processedAccounts, totalAccounts, processedMatches, totalMatches, uniqueFound, duplicates, failedCount, estimatedRemainingMinutes) {
  const pct = progressPercentage.toFixed(1);
  logL(SCHEDULER_PREFIX, 1, `📊 Progress: ${pct}% (${processedAccounts}/${totalAccounts} accounts)`);
  logL(SCHEDULER_PREFIX, 1, `✅ New entries: ${uniqueFound} | ❌ Failed: ${failedCount}`);
  logL(SCHEDULER_PREFIX, 1, `⏱️ Time passed ${formatMinutesHM(elapsedMinutes)} | Estimated time remaining: ${formatMinutesHM(estimatedRemainingMinutes)}`);
}

function logAccountProcessingError(nickname, tag, error) {
  logL(SCHEDULER_PREFIX, 0, `❌ Error processing account ${nickname}#${tag}:`, error.message);
}

function logSyncError(nickname, tag, error) {
  logL(SCHEDULER_PREFIX, 0, `❌ Sync error for account ${nickname}#${tag}:`, error.message);
}

function logFinalSummary(elapsedMinutes, processedAccounts, totalAccounts, totalNewEntries, failedCount) {
  logL(SCHEDULER_PREFIX, 1, `\n📊 FINAL SUMMARY:`);
  logL(SCHEDULER_PREFIX, 1, `⏱️ Total time: ${Math.round(elapsedMinutes)} minutes`);
  logL(SCHEDULER_PREFIX, 1, `👤 Accounts processed: ${processedAccounts}/${totalAccounts}`);
  logL(SCHEDULER_PREFIX, 1, `✅ New entries: ${totalNewEntries}`);
  logL(SCHEDULER_PREFIX, 1, `❌ Failed accounts: ${failedCount}`);
  logL(SCHEDULER_PREFIX, 1, `📈 Success rate: ${totalAccounts > 0 ? Math.round(((processedAccounts - failedCount) / totalAccounts) * 100) : 0}%\n`);
}

function logOptimizationMetrics(batchSize, concurrentBatches, errorCount, processingRate, memoryUsageMB, successRate) {
  logL(SCHEDULER_PREFIX, 1, `⚙️ OPTIMIZATION METRICS:`);
  logL(SCHEDULER_PREFIX, 1, `📦 Batch size: ${batchSize} | 🔄 Concurrent batches: ${concurrentBatches} | 🚫 Errors: ${errorCount}`);
  logL(SCHEDULER_PREFIX, 1, `⚡ Processing rate: ${processingRate} accounts/min | 💾 Memory: ${memoryUsageMB}MB | ✅ Success rate: ${successRate}%`);
}

module.exports = {
  logSchedulerStart,
  logSchedulerComplete,
  logSchedulerError,
  logSkippedAccounts,
  logSyncErrors,
  logSyncAllAccountsError,
  logBatchSizeAdjustment,
  logRateLimitWait,
  logProgress,
  logMemoryUsage,
  logContinuousSyncStopped,
  logPreviousSyncRunning,
  logContinuousSyncStarted,
  logContinuousSyncCompleted,
  logContinuousSyncError,
  logContinuousSyncModeEnabled,
  logSyncSchedulingError,
  logScheduledSyncStarted,
  logScheduledSyncCompleted,
  logScheduledSyncError,
  logUnexpectedTimeout,
  logLegacyScheduleMethod,
  logCurrentProgressDetails,
  logAccountProcessingError,
  logSyncError,
  logFinalSummary,
  logOptimizationMetrics,
  SCHEDULER_PREFIX
}; 