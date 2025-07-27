const express = require('express');
const db = require('../db');
const DataSync = require('../services/dataSync');
const { 
  logAccountFromDb, 
  logAccountFromApi, 
  logAccountFetchedFromApi 
} = require('../debugger/overview');

const router = express.Router();
const sync = new DataSync(process.env.API_KEY);

// Grade hierarchy for comparison
const gradeOrder = ['S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-'];

// Helper functions
function compareGrades(grade1, grade2) {
  if (!grade1 || !grade2) {
    return false;
  }
  const index1 = gradeOrder.indexOf(grade1);
  const index2 = gradeOrder.indexOf(grade2);
  return index1 !== -1 && index2 !== -1 ? index1 <= index2 : false;
}

function sortAchievedGrades(achievedGrades) {
  if (!achievedGrades || achievedGrades.length === 0) {
    return [];
  }
  return achievedGrades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b));
}

function compareRequiredAndAchievedGrades(requiredGradeList, achievedGrades) {
  if (!requiredGradeList || requiredGradeList.length === 0) {
    return [];
  }
  
  const sortedAchieved = sortAchievedGrades(achievedGrades);
  const achievedMarkers = new Array(requiredGradeList.length).fill(false);

  for (const achievedGrade of sortedAchieved) {
    for (let i = 0; i < requiredGradeList.length; i++) {
      if (!achievedMarkers[i] && compareGrades(achievedGrade, requiredGradeList[i])) {
        achievedMarkers[i] = true;
        break;
      }
    }
  }

  return achievedMarkers;
}

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
      logAccountFromApi();
      const continent = sync.regionToContinent(region);
      const data = await sync.api.fetchUser(continent, nickname, tag);
      account = {
        region,
        nickname,
        tag,
        puuid: data.puuid,
      };
      logAccountFetchedFromApi();
    } else {
      logAccountFromDb();
    }

    await sync.syncChampionMastery(region, account.puuid, nickname, tag);

    // Get champion mastery data from API for current data
    const masteryData = await sync.api.fetchMastery(region, account.puuid);
    
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
       WHERE cg.user_id = (SELECT id FROM AccountsToSync WHERE puuid=$1)`,
      [account.puuid]
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
          <link rel="stylesheet" href="/app/web/styles.css">
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Champion Mastery</h1>
                  <div class="subtitle">${nickname}#${tag} (${region.toUpperCase()})</div>
              </div>
              
              <div class="nav-links">
                  <a href="/" class="nav-link">← Back to Search</a>
                  <a href="/${region}/${nickname}-${tag}/history" class="nav-link">View Mastery History</a>
              </div>
              
              <div class="data-table">
                  <table>
                      <tr>
                          <th>Champion</th>
                          <th>Level</th>
                          <th>Points</th>
                          <th>To Next Level</th>
                          <th>Tokens</th>
                          <th>Grades</th>
                      </tr>
    `;

    for (const champion of masteryData) {
      const championId = champion.championId;
      const championName = championMap[championId]?.name || 'Unknown';
      const championIcon = championMap[championId]?.icon || 'https://ddragon.leagueoflegends.com/cdn/15.6.1/img/champion/Unknown.png';
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

      // Generate tokens HTML
      const tokenIcon = '/app/Icons/Mark_of_Mastery.svg';
      const tokensEarned = champion.tokensEarned || 0;
      const tokensRequired = champion.markRequiredForNextLevel || 0;
      let tokensHtml = '<div class="tokens-container">';

      for (let i = 0; i < tokensRequired; i++) {
        const className = i < tokensEarned ? 'token-icon' : 'token-icon token-inactive';
        tokensHtml += `<img src="${tokenIcon}" class="${className}" alt="Token">`;
      }

      if (tokensEarned > tokensRequired) {
        const extraTokens = tokensEarned - tokensRequired;
        tokensHtml += `<span style="margin-left: 5px; color: #4CAF50;">+${extraTokens}</span>`;
      }
      tokensHtml += '</div>';

      html += `
        <tr>
          <td>
            <div class="champion-card">
              <a href="${championLink}">
                <img src="${championIcon}" alt="${championName}" class="champion-icon">
              </a>
              <a href="${championLink}" class="champion-name">${championName}</a>
            </div>
          </td>
          <td>${champion.championLevel}</td>
          <td>${champion.championPoints.toLocaleString()}</td>
          <td>${champion.championPointsUntilNextLevel.toLocaleString()}</td>
          <td>${tokensHtml}</td>
          <td>${gradesHtml}</td>
        </tr>
      `;
    }

    html += `
                  </table>
              </div>
          </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;