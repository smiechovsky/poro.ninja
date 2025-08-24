const db = require('../db');
const {
  logLeaderboardsQuery,
  logLeaderboardsResults,
} = require('../debugger/leaderboards');

async function getChampionLeaderboards() {
  logLeaderboardsQuery('champion leaderboards');

  const query = `
    WITH latest_mastery AS (
      SELECT DISTINCT ON (user_id, champion_id)
        user_id,
        champion_id,
        mastery_points,
        mastery_level,
        last_seen
      FROM ChampionMasteryHistory
      ORDER BY user_id, champion_id, last_seen DESC
    ),
    champion_max_points AS (
      SELECT 
        champion_id,
        MAX(mastery_points) as max_points
      FROM latest_mastery
      GROUP BY champion_id
    )
    SELECT 
      c.id as champion_id,
      c.name as champion_name,
      c.image_url as champion_icon,
      a.region,
      a.nickname,
      a.tag,
      lm.mastery_points,
      lm.mastery_level
    FROM Champions c
    JOIN champion_max_points cmp ON c.id = cmp.champion_id
    JOIN latest_mastery lm ON lm.champion_id = c.id AND lm.mastery_points = cmp.max_points
    JOIN AccountsToSync a ON lm.user_id = a.id
    ORDER BY c.name ASC
  `;

  const { rows } = await db.query(query);
  logLeaderboardsResults(rows.length);
  return rows;
}

async function getChampionTop100(championName) {
  logLeaderboardsQuery('top 100', championName);

  const query = `
    WITH latest_mastery AS (
      SELECT DISTINCT ON (user_id, champion_id)
        user_id,
        champion_id,
        mastery_points,
        mastery_level,
        tokens_earned,
        last_seen
      FROM ChampionMasteryHistory
      ORDER BY user_id, champion_id, last_seen DESC
    ),
    ranked_players AS (
      SELECT 
        a.region,
        a.nickname,
        a.tag,
        lm.mastery_points,
        lm.mastery_level,
        lm.tokens_earned,
        ROW_NUMBER() OVER (ORDER BY lm.mastery_points DESC) as rank
      FROM latest_mastery lm
      JOIN AccountsToSync a ON lm.user_id = a.id
      JOIN Champions c ON lm.champion_id = c.id
      WHERE c.name = $1
    )
    SELECT * FROM ranked_players
    WHERE rank <= 100
    ORDER BY rank ASC
  `;

  const { rows } = await db.query(query, [championName]);
  logLeaderboardsResults(rows.length, championName);
  return rows;
}

// Fetch Top 100 for all champions in a single query
async function getAllChampionsTop100() {
  logLeaderboardsQuery('top 100 - all champions');

  const query = `
    WITH latest_mastery AS (
      SELECT DISTINCT ON (user_id, champion_id)
        user_id,
        champion_id,
        mastery_points,
        mastery_level,
        last_seen
      FROM ChampionMasteryHistory
      ORDER BY user_id, champion_id, last_seen DESC
    ),
    ranked AS (
      SELECT 
        c.id as champion_id,
        c.name as champion_name,
        a.id as user_id,
        a.region,
        a.nickname,
        a.tag,
        lm.mastery_points,
        lm.mastery_level,
        ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY lm.mastery_points DESC) as rank
      FROM latest_mastery lm
      JOIN AccountsToSync a ON lm.user_id = a.id
      JOIN Champions c ON lm.champion_id = c.id
    )
    SELECT champion_name, user_id, region, nickname, tag, mastery_points, mastery_level, rank
    FROM ranked
    WHERE rank <= 100
    ORDER BY champion_name ASC, rank ASC
  `;

  const { rows } = await db.query(query);
  // Group rows by champion_name
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.champion_name) || [];
    list.push(row);
    grouped.set(row.champion_name, list);
  }
  logLeaderboardsResults(rows.length, 'all champions');
  return grouped; // Map<champion_name, Top100Rows[]>
}

module.exports = {
  getChampionLeaderboards,
  getChampionTop100,
  getAllChampionsTop100,
};


