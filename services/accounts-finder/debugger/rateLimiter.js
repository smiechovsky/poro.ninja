const { logL } = require('./config');

const RATE_LIMITER_PREFIX = 'RATE-LIMITER';

function logRateLimitReached(reason, waitTime) {
  logL(RATE_LIMITER_PREFIX, 0, `⏳ Rate limit reached (${reason}): waiting ${Math.ceil(waitTime / 1000)}s`);
}

function logRateLimitReset() {
  logL(RATE_LIMITER_PREFIX, 0, `✅ Rate limit reset, continuing...`);
}

module.exports = {
  logRateLimitReached,
  logRateLimitReset,
  RATE_LIMITER_PREFIX
}; 