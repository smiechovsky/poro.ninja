const express = require('express');
const db = require('../db');
const { addAccountAndWaitForSync } = require('../utils/accountSync');
const { 
  logAccountFromDb,
  logAccountNotFound,
  logAutoAddAccountStart,
  logAutoAddAccountSuccess,
  logAutoAddAccountError
} = require('../debugger/overview');

const router = express.Router();

const { getMasteryRequirements, getNextLevelRequirements, calculateLevelsCanAdvance } = require('../utils/masteryMath');
const { compareRequiredAndAchievedGrades } = require('../utils/grades');
const { renderNav } = require('../utils/nav');

router.get('/:region/:user/overview', async (req, res, next) => {
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
      logAccountNotFound(nickname, tag, region);
      try {
        // Try to add account automatically
        logAutoAddAccountStart(nickname, tag, region);
        account = await addAccountAndWaitForSync(region, nickname, tag);
        logAutoAddAccountSuccess(nickname, tag, region);
      } catch (error) {
        logAutoAddAccountError(nickname, tag, region, error.message);
        return res.status(404).send(`Account not found: ${error.message}`);
      }
    }
    
    logAccountFromDb();

    // Format createdAt for display
    const createdAtPretty = account && account.createdat
      ? new Date(account.createdat).toISOString().slice(0, 10)
      : 'unknown';

    // Get champion mastery data from database (latest entries from history)
    const { rows: masteryData } = await db.query(
      `SELECT DISTINCT ON (cmh.champion_id) 
              cmh.champion_id, cmh.mastery_level as "championLevel", cmh.mastery_points as "championPoints",
              cmh.tokens_earned as "tokensEarned", cmh.tokens_required as "markRequiredForNextLevel",
              cmh.points_until_next_level as "championPointsUntilNextLevel"
       FROM ChampionMasteryHistory cmh
       WHERE cmh.user_id = $1
       ORDER BY cmh.champion_id, cmh.last_seen DESC`,
      [account.id]
    );
    
    // Sort masteryData by championPoints descending
    masteryData.sort((a, b) => (b.championPoints || 0) - (a.championPoints || 0));

    // Get champion map from database
    const { rows: champions } = await db.query('SELECT id, name, image_url FROM Champions');
    const championMap = {};
    champions.forEach(champ => {
      championMap[champ.id] = {
        name: champ.name,
        icon: champ.image_url
      };
    });

    // Get grades data
    const { rows: gradesData } = await db.query(
      `SELECT cg.champion_id, cg.achieved_grades, cg.required_grades
       FROM ChampionGrades cg
       WHERE cg.user_id = $1`,
      [account.id]
    );

    const gradesMap = {};
    gradesData.forEach(grade => {
      gradesMap[grade.champion_id] = {
        achieved: grade.achieved_grades && grade.achieved_grades.trim() ? grade.achieved_grades.split(',') : [],
        required: grade.required_grades && grade.required_grades.trim() ? grade.required_grades.split(',') : []
      };
    });

    // Generate HTML
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Champion Mastery - ${nickname}#${tag}</title>
          <link rel="stylesheet" href="/css/main.css">
      </head>
      <body class="overview-page">
          <div class="container">
              <div class="header">
                  <h1>Champion Mastery</h1>
                  <div class="subtitle">${nickname}#${tag} (${region.toUpperCase()})</div>
                  
              </div>
              
              ${renderNav(region, nickname, tag, (account.lastupdated_mastery || account.lastupdated), { includeHistory: true, includePlayedWith: account.vip === true, includeVipToggle: true, isVip: account.vip === true, createdAtPretty })}
              
              <div class="data-table">
                  <table id="masteryTable">
                                             <tr>
                           <th data-sort="champion">Champion</th>
                           <th data-sort="level">Level</th>
                           <th data-sort="points">Points</th>
                           <th data-sort="progress">Progress</th>
                           <th data-sort="tokens">Tokens</th>
                           <th class="no-sort">Grades</th>
                       </tr>
    `;

    for (const champion of masteryData) {
      const championId = champion.champion_id;
      const championName = championMap[championId]?.name || 'Unknown';
      const championIcon = championMap[championId]?.icon || `https://ddragon.leagueoflegends.com/cdn/${process.env.DDRAGON_Version}/img/champion/Unknown.png`;
      const championLink = `/${region}/${nickname}-${tag}/overview/${championName}`;

      const grades = gradesMap[championId] || { achieved: [], required: [] };
      const requiredGradeList = grades.required;
      const achievedMarkers = requiredGradeList.length > 0 ? compareRequiredAndAchievedGrades(requiredGradeList, grades.achieved) : [];

      // Generate grades HTML
      let gradesHtml = '';
      if (requiredGradeList.length > 0) {
        gradesHtml += '<div class="grades-container">';
        for (let i = 0; i < requiredGradeList.length; i++) {
          const requiredGrade = requiredGradeList[i];
          const achieved = achievedMarkers[i];
          const className = achieved ? 'grade-box grade-achieved' : 'grade-box grade-required';
          gradesHtml += `<div class="${className}">${requiredGrade}</div>`;
        }
        gradesHtml += '</div>';
        
        // Show achieved grades info if available
        if (grades.achieved.length > 0) {
          gradesHtml += `<div class="grade-info">Achieved: ${grades.achieved.join(', ')}</div>`;
        }
      } else {
        // Show achieved grades if no required grades
        if (grades.achieved.length > 0) {
          gradesHtml = `<div class="grade-info">Achieved: ${grades.achieved.join(', ')}</div>`;
        } else {
          gradesHtml = '<div class="grade-info" style="color: #999;">No grades required</div>';
        }
      }

      // Calculate mastery progress
      const masteryLevel = champion.championLevel || 1;
      const masteryPoints = champion.championPoints || 0;
      const tokensEarned = champion.tokensEarned || 0;
      const tokensRequired = champion.markRequiredForNextLevel || 0;
      
      const requirements = getNextLevelRequirements(masteryLevel, masteryPoints);
      const levelsCanAdvance = calculateLevelsCanAdvance(masteryLevel, masteryPoints, tokensEarned, tokensRequired);
      
             // Progress bar color and width based on progress percentage
       let progressColor = '#3b82f6'; // niebieski (normalny)
       let progressWidth = Math.min(100, requirements.progress);
       
       if (requirements.progress >= 300) {
         progressColor = '#dc2626'; // czerwony (300%+)
         progressWidth = Math.min(120, requirements.progress);
       } else if (requirements.progress >= 200) {
         progressColor = '#f97316'; // pomarańczowy (200%+)
         progressWidth = Math.min(110, requirements.progress);
       }
      
                           // Generate progress bar HTML
         const progressBarHtml = `
           <div class="mastery-progress-container">
             <div class="progress-percentage" style="color: ${progressColor};">
               ${Math.round(requirements.progress)}%
             </div>
             
             <div class="progress-bar-container">
               <div 
                 class="progress-bar"
                 style="width: ${progressWidth}%; background-color: ${progressColor};"
               ></div>
             </div>
             
             <div class="progress-details">
               <span class="points-progress">
                 ${requirements.pointsInCurrentLevel.toLocaleString()} / ${requirements.pointsNeededForNextLevel.toLocaleString()}
               </span>
               ${levelsCanAdvance > 0 ? `<span class="level-up-info">+${levelsCanAdvance} Level${levelsCanAdvance > 1 ? 's' : ''}</span>` : ''}
             </div>
           </div>
         `;

      // Generate tokens HTML
      const tokenIcon = '/Icons/Mark_of_Mastery.svg';
      let tokensHtml = '<div class="tokens-container">';

      for (let i = 0; i < tokensRequired; i++) {
        const className = i < tokensEarned ? 'token-icon' : 'token-icon token-inactive';
        tokensHtml += `<img src="${tokenIcon}" class="${className}" alt="Token">`;
      }

      if (tokensEarned > tokensRequired) {
        const extraTokens = tokensEarned - tokensRequired;
        tokensHtml += `<span style="margin-left: 5px; color: #ffffff;">+${extraTokens}</span>`;
        tokensHtml += `<img src="${tokenIcon}" class="token-icon" alt="Token" style="margin-left: 2px;">`;
      }
      tokensHtml += '</div>';

      html += `
        <tr class="card-row">
          <td data-label="Champion" data-champion="${championName}">
            <div class="champion-card">
              <a href="${championLink}">
                <img src="${championIcon}" alt="${championName}" class="champion-icon">
              </a>
              <a href="${championLink}" class="champion-name">${championName}</a>
            </div>
          </td>
           <td data-label="Level" data-level="${masteryLevel}">${masteryLevel}</td>
           <td data-label="Points" data-points="${masteryPoints}">${masteryPoints.toLocaleString()}</td>
           <td data-label="Progress" data-progress="${Math.round(requirements.progress)}">${progressBarHtml}</td>
           <td data-label="Tokens" data-tokens="${tokensEarned}">${tokensHtml}</td>
           <td data-label="Grades" data-grades="${grades.achieved.join(',')}">${gradesHtml}</td>
        </tr>
      `;
    }

    html += `
                  </table>
              </div>
          </div>
          <script src="/js/forceSyncButton.js"></script>
          <script src="/js/tableSort.js"></script>
          </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;