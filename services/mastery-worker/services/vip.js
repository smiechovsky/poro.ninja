const db = require('../db');
const { logLeaderboardsQuery, logLeaderboardsResults } = require('../debugger/leaderboards');

async function grantVipByUserIds(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) return { updated: 0 };

  // Deduplicate
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return { updated: 0 };

  // Update only non-VIP accounts
  logLeaderboardsQuery('grant_vip', `count=${unique.length}`);
  const query = `
    UPDATE AccountsToSync
    SET vip = TRUE, vip_status_added_at = NOW()
    WHERE id = ANY($1) AND (vip IS DISTINCT FROM TRUE);
  `;
  const { rowCount } = await db.query(query, [unique]);
  logLeaderboardsResults(rowCount || 0, 'grant_vip');
  return { updated: rowCount || 0 };
}

module.exports = { grantVipByUserIds };


