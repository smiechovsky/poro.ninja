const { createClient } = require('redis');
const { logLeaderboardsCacheEvent } = require('../debugger/leaderboards');

const isCacheEnabled = process.env.LEADERBOARDS_CACHE_ENABLED !== '0';

let redisClient = null;

function buildRedisClient() {
  if (!isCacheEnabled) return null;

  try {
    if (process.env.REDIS_URL) {
      return createClient({ url: process.env.REDIS_URL });
    }

    const host = process.env.REDIS_HOST || 'redis';
    const port = Number(process.env.REDIS_PORT || 6379);
    const password = process.env.REDIS_PASSWORD || undefined;

    return createClient({
      socket: { host, port },
      password,
    });
  } catch (error) {
    logLeaderboardsCacheEvent('client_error', 'Failed to build Redis client', error);
    return null;
  }
}

async function ensureConnected() {
  if (!isCacheEnabled) return false;
  if (!redisClient) redisClient = buildRedisClient();
  if (!redisClient) return false;

  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
      logLeaderboardsCacheEvent('connect', 'Connected to Redis');
    } catch (error) {
      logLeaderboardsCacheEvent('connect_error', 'Failed to connect to Redis', error);
      return false;
    }
  }
  return true;
}

function namespacedKey(key) {
  const prefix = process.env.LEADERBOARDS_CACHE_PREFIX || 'poro';
  return `${prefix}:${key}`;
}

async function getJson(key) {
  try {
    const ok = await ensureConnected();
    if (!ok) return null;
    const value = await redisClient.get(namespacedKey(key));
    if (!value) {
      logLeaderboardsCacheEvent('miss', key);
      return null;
    }
    logLeaderboardsCacheEvent('hit', key);
    return JSON.parse(value);
  } catch (error) {
    logLeaderboardsCacheEvent('get_error', key, error);
    return null;
  }
}

async function setJson(key, data, ttlSeconds) {
  try {
    const ok = await ensureConnected();
    if (!ok) return false;
    const payload = JSON.stringify(data);
    const ttl = Number(ttlSeconds || process.env.LEADERBOARDS_CACHE_TTL_SECONDS || 3600);
    await redisClient.set(namespacedKey(key), payload, { EX: ttl });
    logLeaderboardsCacheEvent('set', `${key} (ttl=${ttl}s)`);
    return true;
  } catch (error) {
    logLeaderboardsCacheEvent('set_error', key, error);
    return false;
  }
}

module.exports = { getJson, setJson };

// Enhanced multi-set helper with pipelining to reduce RTTs
async function setManyJson(entries, ttlSeconds) {
  try {
    const ok = await ensureConnected();
    if (!ok) return false;
    if (!Array.isArray(entries) || entries.length === 0) return true;

    const ttl = Number(ttlSeconds || process.env.LEADERBOARDS_CACHE_TTL_SECONDS || 3600);
    const multi = redisClient.multi();
    for (const { key, data } of entries) {
      const payload = JSON.stringify(data);
      // Use SET with EX to keep a single command per key
      multi.set(namespacedKey(key), payload, { EX: ttl });
    }

    await multi.exec();
    logLeaderboardsCacheEvent('set_many', `${entries.length} keys (ttl=${ttl}s)`);
    return true;
  } catch (error) {
    logLeaderboardsCacheEvent('set_many_error', `${entries?.length || 0} keys`, error);
    return false;
  }
}

module.exports.setManyJson = setManyJson;


