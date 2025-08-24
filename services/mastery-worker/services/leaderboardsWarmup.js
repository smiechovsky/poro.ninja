const { getJson, setJson, setManyJson } = require('../utils/cache');
const {
  getChampionLeaderboards,
  getChampionTop100,
  getAllChampionsTop100,
} = require('./leaderboardsData');
const { grantVipByUserIds } = require('./vip');
const {
  logLeaderboardsWarmupStart,
  logLeaderboardsWarmupDone,
  logLeaderboardsWarmupError,
  logLeaderboardsRefreshStart,
  logLeaderboardsRefreshDone,
} = require('../debugger/leaderboards');

const DEFAULT_TTL_SECONDS = Number(process.env.LEADERBOARDS_CACHE_TTL_SECONDS || 3600);
const REFRESH_INTERVAL_MS = Number(process.env.LEADERBOARDS_REFRESH_INTERVAL_MS || 3600000); // 60m

async function warmupAll() {
  const startedAt = Date.now();
  try {
    logLeaderboardsWarmupStart();

    // 1) Warmup global champions leaderboard list
    const champions = await getChampionLeaderboards();
    await setJson('leaderboards:champion_top', champions, DEFAULT_TTL_SECONDS);

    // 2) Warmup top100 per champion using a single DB query, then pipelined Redis writes
    const groupedTop100 = await getAllChampionsTop100(); // Map<champion_name, rows[]>
    const entries = [];
    const vipIds = new Set();
    for (const c of champions) {
      const championName = c.champion_name;
      const list = groupedTop100.get(championName) || [];
      // Collect user_ids for VIP granting
      for (const row of list) { if (row.user_id) vipIds.add(row.user_id); }
      entries.push({ key: `leaderboards:top100:${encodeURIComponent(championName)}`, data: list });
    }
    if (entries.length > 0) {
      await setManyJson(entries, DEFAULT_TTL_SECONDS);
    }

    // Grant VIP to all unique Top100 players across champions
    if (vipIds.size > 0) {
      try { await grantVipByUserIds(Array.from(vipIds)); } catch (_) {}
    }

    const count = 1 + entries.length; // champion_top + successful top100

    const duration = Date.now() - startedAt;
    logLeaderboardsWarmupDone(count, duration);
  } catch (error) {
    logLeaderboardsWarmupError(error);
  }
}

function scheduleRefresh() {
  // Periodic refresh of all the keys, full rebuild
  setInterval(async () => {
    const startedAt = Date.now();
    try {
      logLeaderboardsRefreshStart();

      const champions = await getChampionLeaderboards();
      await setJson('leaderboards:champion_top', champions, DEFAULT_TTL_SECONDS);

      const allTop = await getAllChampionsTop100();
      const refreshEntries = [];
      const refreshVipIds = new Set();
      for (const c of champions) {
        const championName = c.champion_name;
        const list = allTop.get(championName) || [];
        for (const row of list) { if (row.user_id) refreshVipIds.add(row.user_id); }
        refreshEntries.push({ key: `leaderboards:top100:${encodeURIComponent(championName)}`, data: list });
      }
      if (refreshEntries.length > 0) {
        await setManyJson(refreshEntries, DEFAULT_TTL_SECONDS);
      }

      if (refreshVipIds.size > 0) {
        try { await grantVipByUserIds(Array.from(refreshVipIds)); } catch (_) {}
      }

      const count = 1 + refreshEntries.length;

      const duration = Date.now() - startedAt;
      logLeaderboardsRefreshDone(count, duration);
    } catch (error) {
      logLeaderboardsWarmupError(error);
    }
  }, REFRESH_INTERVAL_MS);
}

module.exports = { warmupAll, scheduleRefresh };


