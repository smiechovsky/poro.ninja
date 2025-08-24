const { logL } = require('./config');

const VIP_PREFIX = 'VIP';

function formatMinutesHM(minutes) {
  const total = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}H ${mins}M`;
}

function logVipStart(totalAccounts) {
  logL(VIP_PREFIX, 1, `🔄 Starting VIP sync for ${totalAccounts} accounts`);
}

function logVipProgress(processedCount, totalCount, elapsedMinutes, estimatedRemainingMinutes, failedCount) {
  const percentage = ((processedCount / Math.max(totalCount || 1, 1)) * 100).toFixed(1);
  logL(VIP_PREFIX, 1, `📊 VIP Progress: ${percentage}% (${processedCount}/${totalCount} accounts)`);
  logL(VIP_PREFIX, 1, `❌ Failed in run: ${failedCount || 0}`);
  logL(VIP_PREFIX, 1, `⏱️ Time passed ${formatMinutesHM(elapsedMinutes)} | Estimated remaining: ${formatMinutesHM(estimatedRemainingMinutes)}`);
}

function logVipComplete(processedCount, totalCount, durationSeconds, failedCount) {
  const durationMinutes = (durationSeconds / 60).toFixed(1);
  logL(VIP_PREFIX, 1, `✅ VIP sync completed: ${processedCount}/${totalCount} accounts in ${durationMinutes}m | ❌ Failed: ${failedCount || 0}`);
}

module.exports = {
  logVipStart,
  logVipProgress,
  logVipComplete
};


