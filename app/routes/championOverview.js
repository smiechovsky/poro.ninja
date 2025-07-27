const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/:region/:user/overview/:champion', async (req, res, next) => {
  try {
    const { region, user, champion } = req.params;
    const [nickname, tag] = user.split('-');

    const q = `SELECT mastery_points, first_seen FROM ChampionMasteryHistory
               WHERE champion_id=(SELECT id FROM Champions WHERE name=$1)
               AND user_id=(SELECT id FROM AccountsToSync WHERE nickname=$2 AND tag=$3 AND region=$4)
               ORDER BY first_seen ASC`;
    const { rows } = await db.query(q, [champion, nickname, tag, region]);
    if (!rows.length) return res.status(404).send('No data');

    // Przygotuj dane do wykresu
    const dates = rows.map(r => r.first_seen);
    const masteryPoints = rows.map(r => r.mastery_points);

    // Generate table HTML
    let tableHtml = `<div class="data-table"><table><tr><th>Date</th><th>Mastery Points</th></tr>`;
    for (let i = 0; i < rows.length; i++) {
      tableHtml += `<tr><td>${new Date(dates[i]).toLocaleDateString()}</td><td>${masteryPoints[i].toLocaleString()}</td></tr>`;
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
          <link rel="stylesheet" href="/app/web/styles.css">
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
                  <canvas id="masteryChart" width="800" height="400"></canvas>
              </div>
              
              ${tableHtml}
              
              <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
              <script>
                const ctx = document.getElementById('masteryChart').getContext('2d');
                const masteryChart = new Chart(ctx, {
                  type: 'line',
                  data: {
                    labels: ${JSON.stringify(dates.map(d => new Date(d).toLocaleDateString()))},
                    datasets: [{
                      label: 'Mastery Points',
                      data: ${JSON.stringify(masteryPoints)},
                      borderColor: '#4a90e2',
                      backgroundColor: 'rgba(74, 144, 226, 0.2)',
                      borderWidth: 3,
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: '#4a90e2',
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2,
                      pointRadius: 4,
                      pointHoverRadius: 6
                    }]
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        labels: {
                          color: '#e0e0e0',
                          font: {
                            size: 14
                          }
                        }
                      }
                    },
                    scales: {
                      x: { 
                        title: { 
                          display: true, 
                          text: 'Date',
                          color: '#e0e0e0',
                          font: {
                            size: 14
                          }
                        },
                        ticks: {
                          color: '#b0b0b0'
                        },
                        grid: {
                          color: 'rgba(255, 255, 255, 0.1)'
                        }
                      },
                      y: { 
                        title: { 
                          display: true, 
                          text: 'Mastery Points',
                          color: '#e0e0e0',
                          font: {
                            size: 14
                          }
                        },
                        ticks: {
                          color: '#b0b0b0'
                        },
                        grid: {
                          color: 'rgba(255, 255, 255, 0.1)'
                        }
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