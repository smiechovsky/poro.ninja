const db = require('../db');

async function upsertUser(puuid, region, nickname, tag, continent) {
  const res = await db.query(
    `INSERT INTO AccountsToSync(region,nickname,tag,puuid,continent,lastupdated,createdat)
     VALUES($1,$2,$3,$4,$5,NOW(),NOW())
     ON CONFLICT (puuid) DO UPDATE SET lastupdated=NOW()
     RETURNING id`,
    [region, nickname, tag, puuid, continent]
  );
  return res.rows[0].id;
}

async function upsertMastery(userId, data) {
  const q = `INSERT INTO ChampionMasteryHistory(user_id, champion_id, mastery_level,
      mastery_points, tokens_earned, points_since_last_level,
      points_until_next_level, tokens_required, first_seen, last_seen)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
    ON CONFLICT ON CONSTRAINT unique_history DO UPDATE SET last_seen=NOW();`;
  const p = [userId, data.championId, data.championLevel, data.championPoints,
    data.tokensEarned || 0, data.championPointsSinceLastLevel,
    data.championPointsUntilNextLevel, data.markRequiredForNextLevel];
  await db.query(q, p);
}

async function upsertGrades(userId, championId, achieved, required, newGrade) {
  const q = `INSERT INTO ChampionGrades(user_id, champion_id, achieved_grades,
      required_grades, new_grade, first_seen, last_seen)
    VALUES($1,$2,$3,$4,$5,NOW(),NOW())
    ON CONFLICT (user_id,champion_id) DO UPDATE SET
      achieved_grades=COALESCE($3,ChampionGrades.achieved_grades),
      required_grades=COALESCE($4,ChampionGrades.required_grades),
      new_grade=COALESCE($5,ChampionGrades.new_grade),
      last_seen=NOW();`;
  await db.query(q, [userId, championId, achieved || null, required || null, newGrade || null]);
}

async function listAccounts() {
  const { rows } = await db.query('SELECT * FROM AccountsToSync');
  return rows;
}
module.exports = { upsertUser, upsertMastery, upsertGrades, listAccounts };