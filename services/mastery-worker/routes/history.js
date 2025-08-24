const express = require('express');
const db = require('../db');
const { addAccountAndWaitForSync } = require('../utils/accountSync');
const { 
  logHistoryAccountNotFound,
  logHistoryAutoAddAccountStart,
  logHistoryAutoAddAccountSuccess,
  logHistoryAutoAddAccountError
} = require('../debugger/overview');
const router = express.Router();
const { renderNav } = require('../utils/nav');

const INITIAL_LIMIT = 50;

function buildEntryHtml(region, nickname, tag, row){
  const championLink = `/${region}/${nickname}-${tag}/overview/${row.champion_name}`;
  const date = new Date(row.last_seen).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  return `
    <div class="history-entry">
      <div class="history-header">
        <div class="history-champion">
          <a href="${championLink}"><img src="${row.champion_icon}" alt="${row.champion_name}" class="champion-icon"></a>
          <a href="${championLink}" class="champion-name">${row.champion_name}</a>
        </div>
        <div class="history-date">${date}</div>
      </div>
      <div class="history-changes">
        ${row.points_gain > 0 ? `<div class=\"change-item change-positive\">+${row.points_gain} points</div>` : ''}
        ${row.level_up ? `<div class=\"change-item change-level\">🎯 Level Up!</div>` : ''}
        ${row.token_gain ? `<div class=\"change-item change-positive\">🎖️ +${row.tokens_gained} token${row.tokens_gained > 1 ? 's' : ''}</div>` : ''}
        ${row.grade_change ? `<div class=\"change-item change-level\">⭐ New Grade: ${row.grade_change}</div>` : ''}
        ${(!row.points_gain && !row.level_up && !row.token_gain && !row.grade_change) ? '<div class=\"change-item\">No changes</div>' : ''}
      </div>
    </div>
  `;
}

async function fetchHistoryChanges(db, userId, cursorIso, limit){
  const q = `
    WITH base AS (
      SELECT 
        cmh.champion_id,
        c.name AS champion_name,
        c.image_url AS champion_icon,
        cmh.last_seen,
        cmh.mastery_points,
        cmh.mastery_level,
        cmh.tokens_earned,
        LAG(cmh.mastery_points) OVER (PARTITION BY cmh.champion_id ORDER BY cmh.last_seen) AS prev_points,
        LAG(cmh.mastery_level)  OVER (PARTITION BY cmh.champion_id ORDER BY cmh.last_seen) AS prev_level,
        LAG(cmh.tokens_earned) OVER (PARTITION BY cmh.champion_id ORDER BY cmh.last_seen) AS prev_tokens,
        cg.new_grade
      FROM ChampionMasteryHistory cmh
      JOIN Champions c ON cmh.champion_id = c.id
      LEFT JOIN ChampionGrades cg ON cmh.user_id = cg.user_id AND cmh.champion_id = cg.champion_id
      WHERE cmh.user_id = $1
        AND ($2::timestamp IS NULL OR cmh.last_seen < $2)
    )
    SELECT 
      champion_id,
      champion_name,
      champion_icon,
      last_seen,
      GREATEST(0, mastery_points - COALESCE(prev_points, mastery_points)) AS points_gain,
      (COALESCE(prev_level, mastery_level) < mastery_level) AS level_up,
      (COALESCE(prev_tokens, tokens_earned) < tokens_earned) AS token_gain,
      GREATEST(0, tokens_earned - COALESCE(prev_tokens, tokens_earned)) AS tokens_gained,
      new_grade AS grade_change
    FROM base
    WHERE 
      (mastery_points <> COALESCE(prev_points, mastery_points)) OR
      (mastery_level  <> COALESCE(prev_level,  mastery_level)) OR
      (tokens_earned  <> COALESCE(prev_tokens, tokens_earned)) OR
      new_grade IS NOT NULL
    ORDER BY last_seen DESC
    LIMIT $3`;
  const { rows } = await db.query(q, [userId, cursorIso || null, limit]);
  const nextCursor = rows.length > 0 ? rows[rows.length - 1].last_seen : null;
  return { rows, nextCursor };
}

router.get('/:region/:user/history', async (req, res, next) => {
  try {
    const { region, user } = req.params;
    const [nickname, tag] = user.split('-');

    // Get user ID, created at and last updated timestamp
    let idRes = await db.query(
      `SELECT id, createdat, vip, COALESCE(lastupdated_mastery, lastupdated) AS lastupdated FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3`,
      [region, nickname, tag]
    );
    let userId = idRes.rows[0]?.id;
    const isVip = idRes.rows[0]?.vip === true;
    let accountLastUpdated = idRes.rows[0]?.lastupdated || null;
    const accountCreatedAt = idRes.rows[0]?.createdat || null;
    let createdAtFromAuto = null;

    if (!userId) {
      logHistoryAccountNotFound(nickname, tag, region);
      try {
        // Try to add account automatically
        logHistoryAutoAddAccountStart(nickname, tag, region);
        const account = await addAccountAndWaitForSync(region, nickname, tag);
        userId = account.id;
        accountLastUpdated = (account.lastupdated_mastery || account.lastupdated) || null;
        // created at from auto-added account
        createdAtFromAuto = account.createdat || null;
        logHistoryAutoAddAccountSuccess(nickname, tag, region);
      } catch (error) {
        logHistoryAutoAddAccountError(nickname, tag, region, error.message);
        return res.status(404).send(`User not found: ${error.message}`);
      }
    }

    // Fetch first page of computed changes
    const { rows, nextCursor } = await fetchHistoryChanges(db, userId, null, INITIAL_LIMIT);

    const createdAtPretty = (accountCreatedAt || createdAtFromAuto)
      ? new Date(accountCreatedAt || createdAtFromAuto).toISOString().replace('T', ' ').slice(0, 16)
      : 'unknown';

    if (!rows.length) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Mastery History - ${nickname}#${tag}</title>
            <link rel="stylesheet" href="/css/main.css">
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Mastery History</h1>
                    <div class="subtitle">${nickname}#${tag} (${region.toUpperCase()})</div>
                    
                </div>
                
                 ${renderNav(region, nickname, tag, accountLastUpdated, { includeOverview: true })}
                
                <div class="error">No mastery history found for this user.</div>
            </div>
            <script src="/js/forceSyncButton.js"></script>
        </body>
        </html>
      `);
    }

    // Server returned a page of computed changes; render directly

    // Generate HTML table
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Mastery History - ${nickname}#${tag}</title>
          <link rel="stylesheet" href="/css/main.css">
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Mastery History</h1>
                  <div class="subtitle">${nickname}#${tag} (${region.toUpperCase()})</div>
                  <div class="subtitle">Added to database: ${createdAtPretty}</div>
              </div>
              
              ${renderNav(region, nickname, tag, accountLastUpdated, { includeOverview: true, includePlayedWith: isVip, createdAtPretty })}
              <div id="historyFeed">
                ${rows.map(r => buildEntryHtml(region, nickname, tag, r)).join('\n')}
              </div>
              <div id="infiniteSentinel" data-next-cursor="${nextCursor ? new Date(nextCursor).toISOString() : ''}" style="height:1px;"></div>
    `;

    html += `
          </div>
      <script src="/js/forceSyncButton.js"></script>
      <script src="/js/historyInfinite.js"></script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

// JSON feed for infinite scroll
router.get('/:region/:user/history-feed', async (req, res, next) => {
  try {
    const { region, user } = req.params;
    const { cursor, limit } = req.query;
    const [nickname, tag] = user.split('-');
    const lim = Math.min(Math.max(parseInt(limit || INITIAL_LIMIT, 10) || INITIAL_LIMIT, 10), 200);

    const idRes = await db.query(
      `SELECT id FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3`,
      [region, nickname, tag]
    );
    const userId = idRes.rows[0]?.id;
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const { rows, nextCursor } = await fetchHistoryChanges(db, userId, cursor || null, lim);
    const entriesHtml = rows.map(r => buildEntryHtml(region, nickname, tag, r)).join('\n');
    return res.json({ entriesHtml, nextCursor: nextCursor ? new Date(nextCursor).toISOString() : null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;