const express = require('express');
const db = require('../db');
const { addAccountAndWaitForSync } = require('../utils/accountSync');
const { renderNav } = require('../utils/nav');

const router = express.Router();

router.get('/:region/:user/played-with', async (req, res, next) => {
  try {
    const { region, user } = req.params;
    const [nickname, tag] = user.split('-');
    if (!nickname || !tag) return res.status(400).send('Bad request');

    const { rows } = await db.query(
      'SELECT * FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3',
      [region, nickname, tag]
    );
    let account = rows[0];

    if (!account) {
      account = await addAccountAndWaitForSync(region, nickname, tag);
    }

    if (!account.vip) {
      return res.status(403).send('This page is available for VIP accounts only.');
    }

    // Use account's lastupdated_played_with for nav
    const { rows: lastRows } = await db.query(
      'SELECT lastupdated_played_with AS lastupdated FROM AccountsToSync WHERE id = $1',
      [account.id]
    );
    const playedWithLastUpdated = lastRows[0]?.lastupdated || null;

    const vipStatusAddedAtPretty = account && account.vip_status_added_at
      ? new Date(account.vip_status_added_at).toISOString().slice(0, 10)
      : null;

    const q = `
      SELECT
        pw.other_user_id AS other_id,
        COUNT(DISTINCT pw.match_id) AS match_count,
        MAX(sm.scanned_at) AS last_time_played,
        a.nickname, a.tag, a.region
      FROM PlayedWith pw
      JOIN AccountsToSync a ON a.id = pw.other_user_id
      LEFT JOIN (
        SELECT match_id, MAX(scanned_at) AS scanned_at
        FROM ScannedMatches
        GROUP BY match_id
      ) sm ON sm.match_id = pw.match_id
      WHERE pw.user_id = $1
      GROUP BY pw.other_user_id, a.nickname, a.tag, a.region
      ORDER BY match_count DESC, a.nickname ASC
      LIMIT 200
    `;
    const { rows: played } = await db.query(q, [account.id]);

    // Count unique matches for the Played with list
    const { rows: countRows } = await db.query(
      'SELECT COUNT(DISTINCT match_id) AS unique_matches FROM PlayedWith WHERE user_id = $1',
      [account.id]
    );
    const uniqueMatches = Number(countRows[0]?.unique_matches || 0);

    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Played with - ${nickname}#${tag}</title>
          <link rel="stylesheet" href="/css/main.css">
          <link rel="stylesheet" href="/css/leaderboards.css">
      </head>
      <body class="overview-page">
          <div class="container">
              <div class="header">
                  <h1>Played with <span class="played-with-count">in last ${uniqueMatches} games</span></h1>
                  <div class="subtitle">${nickname}#${tag} (${region.toUpperCase()})</div>
              </div>
              ${renderNav(region, nickname, tag, playedWithLastUpdated, { includeOverview: true, includeHistory: true, includeVipToggle: true, isVip: true, vipStatusAddedAtPretty })}
              <div class="data-table">
                <table id="playedWithTable">
                  <tr>
                    <th data-sort="nickname">Nickname</th>
                    <th data-sort="last">Last time played</th>
                    <th data-sort="count">Matches together</th>
                  </tr>
    `;

    for (const row of played) {
      const link = `/${row.region}/${encodeURIComponent(row.nickname)}-${row.tag}/overview`;
      const ts = row.last_time_played ? new Date(row.last_time_played).getTime() : 0;
      const pretty = row.last_time_played ? new Date(row.last_time_played).toISOString().replace('T', ' ').slice(0, 16) : 'unknown';
      html += `
        <tr>
          <td data-nickname="${row.nickname.toLowerCase()}"><a href="${link}" class="player-link">${row.nickname}#${row.tag}</a></td>
          <td data-last="${ts}">${pretty}</td>
          <td data-count="${row.match_count}">${row.match_count}</td>
        </tr>
      `;
    }

    html += `
                </table>
              </div>
          </div>
          <script>
            (function(){
              const table = document.getElementById('playedWithTable');
              if (!table) return;
              const getVal = (tr, key) => {
                const el = tr.querySelector('[data-' + key + ']');
                return (el && el.dataset && el.dataset[key]) ? el.dataset[key] : '';
              };
              const cmp = (key, asc, numeric=false) => (a,b) => {
                let v1 = getVal(asc ? a : b, key);
                let v2 = getVal(asc ? b : a, key);
                if (numeric) { v1 = parseInt(v1||'0',10)||0; v2 = parseInt(v2||'0',10)||0; return v1 - v2; }
                return String(v1).localeCompare(String(v2));
              };
              Array.from(table.querySelectorAll('th')).forEach(th => {
                const key = th.dataset.sort;
                if (!key) return;
                th.addEventListener('click', () => {
                  const asc = th.classList.toggle('asc');
                  th.classList.toggle('desc', !asc);
                  Array.from(table.querySelectorAll('th')).forEach(oth => { if (oth!==th) oth.classList.remove('asc','desc'); });
                  const rows = Array.from(table.querySelectorAll('tr:nth-child(n+2)'));
                  const numeric = (key === 'last' || key === 'count');
                  rows.sort(cmp(key, asc, numeric));
                  rows.forEach(tr => table.appendChild(tr));
                });
              });
            })();
          </script>
          <script src="/js/forceSyncButton.js"></script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;


