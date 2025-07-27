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

    // Generuj tabelę HTML
    let tableHtml = `<table border="1" cellpadding="8"><tr><th>Date</th><th>Mastery Points</th></tr>`;
    for (let i = 0; i < rows.length; i++) {
      tableHtml += `<tr><td>${dates[i]}</td><td>${masteryPoints[i]}</td></tr>`;
    }
    tableHtml += `</table>`;

    // Strona HTML z wykresem i tabelą
    res.send(`
      <h1>Mastery History for ${champion}</h1>
      <canvas id="masteryChart" width="800" height="400"></canvas>
      ${tableHtml}
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <script>
        const ctx = document.getElementById('masteryChart').getContext('2d');
        const masteryChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(dates)},
            datasets: [{
              label: 'Mastery Points',
              data: ${JSON.stringify(masteryPoints)},
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderWidth: 2,
              fill: true,
            }]
          },
          options: {
            responsive: true,
            scales: {
              x: { title: { display: true, text: 'Date' } },
              y: { title: { display: true, text: 'Mastery Points' } }
            }
          }
        });
      </script>
    `);
  } catch (err) {
    next(err);
  }
});

module.exports = router;