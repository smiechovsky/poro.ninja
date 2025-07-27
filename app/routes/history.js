const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/:region/:user/history', async (req, res, next) => {
  try {
    const { region, user } = req.params;
    const [nickname, tag] = user.split('-');

    // Get user ID
    const idRes = await db.query(
      `SELECT id FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3`,
      [region, nickname, tag]
    );
    const userId = idRes.rows[0]?.id;
    if (!userId) return res.status(404).send('User not found');

    // Get mastery history with champion details and grades
    const { rows } = await db.query(
      `SELECT cmh.champion_id, cmh.mastery_level, cmh.mastery_points, cmh.tokens_earned, 
              cmh.points_since_last_level, cmh.points_until_next_level, cmh.tokens_required,
              cmh.first_seen, cmh.last_seen,
              c.name AS champion_name, c.image_url AS champion_icon,
              cg.achieved_grades, cg.required_grades, cg.new_grade, cg.last_seen AS grade_last_seen
       FROM ChampionMasteryHistory cmh
       JOIN Champions c ON cmh.champion_id = c.id
       LEFT JOIN ChampionGrades cg ON cmh.user_id = cg.user_id AND cmh.champion_id = cg.champion_id
       WHERE cmh.user_id = $1
       ORDER BY cmh.champion_id ASC, cmh.last_seen DESC`,
      [userId]
    );

    if (!rows.length) {
      return res.send(`<h1>Mastery History for ${nickname}#${tag}</h1><p>No mastery history found for this user.</p>`);
    }

    // Group entries by champion and detect changes
    const championHistory = {};
    rows.forEach(entry => {
      const championId = entry.champion_id;
      if (!championHistory[championId]) {
        championHistory[championId] = [];
      }
      championHistory[championId].push(entry);
    });

    // Calculate changes for each champion
    const allEntries = [];
    Object.values(championHistory).forEach(entries => {
      if (entries.length < 2) {
        return; // Skip champions with only 1 entry
      }

      for (let i = 1; i < entries.length; i++) {
        const entry = entries[i - 1];
        const previousEntry = entries[i];

        const masteryPoints = parseInt(entry.mastery_points) || 0;
        const previousPoints = parseInt(previousEntry.mastery_points) || 0;
        const pointsGain = Math.max(0, masteryPoints - previousPoints);

        // Detect level up
        const currentLevel = parseInt(entry.mastery_level) || 0;
        const previousLevel = parseInt(previousEntry.mastery_level) || 0;
        const levelUp = currentLevel > previousLevel;
        
        // Detect token gain
        const currentTokens = parseInt(entry.tokens_earned) || 0;
        const previousTokens = parseInt(previousEntry.tokens_earned) || 0;
        const tokenGain = currentTokens > previousTokens;
        const tokensGained = Math.max(0, currentTokens - previousTokens);
        
        // Detect grade changes (if grade data is available)
        let gradeChange = null;
        if (entry.new_grade && (!previousEntry.new_grade || entry.new_grade !== previousEntry.new_grade)) {
          gradeChange = entry.new_grade;
        }

        // Only add entry if there are meaningful changes
        if (pointsGain > 0 || levelUp || tokenGain || gradeChange) {
                  allEntries.push({
          champion_name: entry.champion_name,
          champion_icon: entry.champion_icon,
          points_gain: pointsGain,
          level_up: levelUp,
          token_gain: tokenGain,
          tokens_gained: tokensGained,
          grade_change: gradeChange,
          date: new Date(entry.last_seen).toLocaleString('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }),
          timestamp: new Date(entry.last_seen).getTime()
        });
        }
      }
    });

    // Sort entries by timestamp (newest first)
    allEntries.sort((a, b) => b.timestamp - a.timestamp);

    // Generate HTML table
    let html = `
      <h1>Mastery History for ${nickname}#${tag}</h1>
      <table border="1" cellpadding="10">
        <tr>
          <th>Champion</th>
          <th>Changes</th>
          <th>Date</th>
        </tr>
    `;

    allEntries.forEach(entry => {
      const championLink = `/${region}/${nickname}-${tag}/overview/${entry.champion_name}`;
      
      // Build changes description
      let changes = [];
      if (entry.points_gain > 0) {
        changes.push(`+${entry.points_gain} points`);
      }
      if (entry.level_up) {
        changes.push('🎯 Level Up!');
      }
      if (entry.token_gain) {
        changes.push(`🎖️ +${entry.tokens_gained} token${entry.tokens_gained > 1 ? 's' : ''}`);
      }
      if (entry.grade_change) {
        changes.push(`⭐ New Grade: ${entry.grade_change}`);
      }
      
      const changesText = changes.length > 0 ? changes.join(', ') : 'No changes';
      
      html += `
        <tr>
          <td>
            <a href="${championLink}">
              <img src="${entry.champion_icon}" alt="${entry.champion_name}" style="width: 32px; height: 32px; vertical-align: middle;">
              ${entry.champion_name}
            </a>
          </td>
          <td>${changesText}</td>
          <td>${entry.date}</td>
        </tr>
      `;
    });

    html += '</table>';

    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;