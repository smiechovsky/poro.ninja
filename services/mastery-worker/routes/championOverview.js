const express = require('express');
const db = require('../db');
const { addAccountAndWaitForSync } = require('../utils/accountSync');
const { 
  logChampionOverviewAccountNotFound,
  logChampionOverviewAutoAddAccountStart,
  logChampionOverviewAutoAddAccountSuccess,
  logChampionOverviewAutoAddAccountError
} = require('../debugger/overview');
const router = express.Router();

router.get('/:region/:user/overview/:champion', async (req, res, next) => {
  try {
    const { region, user, champion } = req.params;
    const [nickname, tag] = user.split('-');

    // Check if user exists, if not add them
    let userId = null;
    const userCheck = await db.query(
      'SELECT id FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3',
      [region, nickname, tag]
    );

    if (userCheck.rows.length === 0) {
      logChampionOverviewAccountNotFound(nickname, tag, region);
      try {
        logChampionOverviewAutoAddAccountStart(nickname, tag, region);
        const account = await addAccountAndWaitForSync(region, nickname, tag);
        userId = account.id;
        logChampionOverviewAutoAddAccountSuccess(nickname, tag, region);
      } catch (error) {
        logChampionOverviewAutoAddAccountError(nickname, tag, region, error.message);
        return res.status(404).send(`User not found: ${error.message}`);
      }
    } else {
      userId = userCheck.rows[0].id;
    }

    const q = `SELECT mastery_points, mastery_level, tokens_earned, tokens_required, 
                      points_since_last_level, points_until_next_level, first_seen, last_seen 
               FROM ChampionMasteryHistory
               WHERE champion_id=(SELECT id FROM Champions WHERE name=$1)
               AND user_id=$2
               ORDER BY first_seen ASC`;
    const { rows } = await db.query(q, [champion, userId]);
    if (!rows.length) return res.status(404).send('No data');

    // Przygotuj dane do wykresu
    // Build series using last_seen when available (fallback to first_seen)
    const timestamps = rows.map(r => r.last_seen || r.first_seen);
    const masteryPoints = rows.map(r => r.mastery_points);
    const masteryLevels = rows.map(r => r.mastery_level);
    const tokensCumulative = rows.map(r => r.tokens_earned || 0);
    const tokensGainedSeries = tokensCumulative.map((val, idx) => {
      if (idx === 0) return 0;
      const prev = tokensCumulative[idx - 1] || 0;
      return Math.max(0, (val || 0) - prev);
    });

    // Generate simplified history-like table (no sorting on this page)
    let tableHtml = `
      <div class="data-table">
        <table>
          <tr>
            <th class="no-sort">Date</th>
            <th class="no-sort">Level</th>
            <th class="no-sort">Mastery Points</th>
            <th class="no-sort"></th>
          </tr>`;
    
    // Prepare rows with computed changes in chronological order, then render newest first
    const computedEntries = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const currentTimestamp = row.last_seen || row.first_seen;
      const date = new Date(currentTimestamp).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const previous = i > 0 ? rows[i - 1] : null;
      const pointsGain = previous ? Math.max(0, (row.mastery_points || 0) - (previous.mastery_points || 0)) : 0;
      const tokenGain = i > 0 ? Math.max(0, (row.tokens_earned || 0) - (rows[i - 1].tokens_earned || 0)) : 0;
      const levelUp = previous ? (parseInt(row.mastery_level || 0) > parseInt(previous.mastery_level || 0)) : false;
      const chipsHtml = [
        pointsGain > 0 ? `<div class=\"change-item change-positive\">+${pointsGain.toLocaleString()} points</div>` : '',
        levelUp ? `<div class=\"change-item change-level\">🎯 Level Up!</div>` : '',
        tokenGain > 0 ? `<div class=\"change-item change-positive\">🎖️ +${tokenGain} token${tokenGain > 1 ? 's' : ''}</div>` : ''
      ].filter(Boolean).join('');
      computedEntries.push({
        timestamp: new Date(currentTimestamp).getTime(),
        date,
        level: row.mastery_level || 0,
        points: (row.mastery_points || 0),
        chipsHtml
      });
    }

    // Render descending by time (newest at top)
    for (let i = computedEntries.length - 1; i >= 0; i--) {
      const e = computedEntries[i];
      tableHtml += `
        <tr>
          <td>${e.date}</td>
          <td>${e.level}</td>
          <td>${e.points.toLocaleString()}</td>
          <td><div class=\"history-changes\">${e.chipsHtml}</div></td>
        </tr>`;
    }
    tableHtml += `</table></div>`;

    // Get user info for navigation
    const [userNickname, userTag] = user.split('-');

    // HTML page with chart and table
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${champion} Mastery - ${userNickname}#${userTag}</title>
          <link rel="stylesheet" href="/css/main.css">
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>${champion} Mastery</h1>
                  <div class="subtitle">${userNickname}#${userTag} (${region.toUpperCase()})</div>
              </div>
              
              <div class="nav-links">
                  <a href="/" class="nav-link">← Back to Search</a>
                  <a href="/${region}/${userNickname}-${userTag}/overview" class="nav-link">View Overview</a>
                  <a href="/${region}/${userNickname}-${userTag}/history" class="nav-link">View History</a>
              </div>
              
              <div class="chart-container">
                  <canvas id="combinedChart" width="800" height="450"></canvas>
              </div>
              
              ${tableHtml}
              
              <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
              <script>
                const labels = ${JSON.stringify(timestamps.map(d => new Date(d).toLocaleDateString()))};
                const combinedCtx = document.getElementById('combinedChart').getContext('2d');
                new Chart(combinedCtx, {
                  data: {
                    labels,
                    datasets: [
                      {
                        type: 'line',
                        label: 'Mastery Points',
                        data: ${JSON.stringify(masteryPoints)},
                        borderColor: '#4a90e2',
                        backgroundColor: 'rgba(74, 144, 226, 0.2)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.35,
                        yAxisID: 'yPoints',
                        pointBackgroundColor: '#4a90e2',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 3
                      },
                      {
                        type: 'line',
                        label: 'Mastery Level',
                        data: ${JSON.stringify(masteryLevels)},
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.15)',
                        borderWidth: 3,
                        fill: false,
                        stepped: true,
                        yAxisID: 'yLevel',
                        pointBackgroundColor: '#4CAF50',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                      },
                      {
                        type: 'line',
                        label: 'Tokens Owned',
                        data: ${JSON.stringify(tokensCumulative)},
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.15)',
                        borderWidth: 2,
                        fill: false,
                        yAxisID: 'yTokens',
                        tension: 0.2,
                        pointBackgroundColor: '#FF9800',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 3
                      }
                    ]
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { labels: { color: '#e0e0e0' } },
                      tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                      x: {
                        title: { display: true, text: 'Date', color: '#e0e0e0' },
                        ticks: { color: '#b0b0b0' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                      },
                      yPoints: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Mastery Points', color: '#e0e0e0' },
                        ticks: { color: '#b0b0b0' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                      },
                      yLevel: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Level', color: '#e0e0e0' },
                        ticks: { color: '#b0b0b0', stepSize: 1 },
                        grid: { drawOnChartArea: false }
                      },
                      yTokens: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Tokens', color: '#e0e0e0' },
                        ticks: { color: '#b0b0b0', stepSize: 1 },
                        grid: { drawOnChartArea: false },
                        suggestedMax: 3
                      }
                    }
                  }
                });
              </script>
          </div>
      </body>
      </html>
    `);
  } catch (err) {
    next(err);
  }
});

module.exports = router;