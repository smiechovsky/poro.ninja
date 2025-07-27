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
      <h1>Champion Mastery for ${nickname}#${tag}</h1>
      <a href="/${region}/${nickname}-${tag}/history">View Mastery History</a>
      <table border="1" cellpadding="10">
        <tr>
          <th>Champion Icon</th>
          <th>Mastery Level</th>
          <th>Mastery Points</th>
          <th>Points to Next Level</th>
          <th>Required Tokens</th>
          <th>Required Grades</th>
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
        for (let i = 0; i < requiredGradeList.length; i++) {
          const requiredGrade = requiredGradeList[i];
          const achieved = achievedMarkers[i];
          const style = achieved 
            ? 'background-color: #4CAF50; color: white;' 
            : 'background-color: transparent; color: #ccc;';
          gradesHtml += `<div style="display: inline-block; width: 20px; height: 20px; margin: 0 5px; border: 1px solid black; text-align: center; line-height: 20px; ${style}">${requiredGrade}</div>`;
        }
        
        // Show achieved grades info if available
        if (grades.achieved.length > 0) {
          gradesHtml += `<br><small style="color: #4CAF50;">Achieved: ${grades.achieved.join(', ')}</small>`;
        }
      } else {
        // Show achieved grades if no required grades
        if (grades.achieved.length > 0) {
          gradesHtml = `<span style="color: #4CAF50;">Achieved: ${grades.achieved.join(', ')}</span>`;
        } else {
          gradesHtml = '<span style="color: #999;">No grades required</span>';
        }
      }

      // Generate tokens HTML
      const tokenIcon = '/app/Icons/Mark_of_Mastery.svg';
      const tokensEarned = champion.tokensEarned || 0;
      const tokensRequired = champion.markRequiredForNextLevel || 0;
      let tokensHtml = '';

      for (let i = 0; i < tokensRequired; i++) {
        const opacity = i < tokensEarned ? '' : 'opacity: 0.3;';
        tokensHtml += `<img src="${tokenIcon}" style="width: 20px; height: 20px; ${opacity}" alt="Token">`;
      }

      if (tokensEarned > tokensRequired) {
        const extraTokens = tokensEarned - tokensRequired;
        tokensHtml += ` + <img src="${tokenIcon}" style="width: 20px; height: 20px;" alt="Token"> x${extraTokens}`;
      }

      html += `
        <tr>
          <td style="text-align: center;">
            <a href="${championLink}">
              <img src="${championIcon}" alt="${championName}" width="50" height="50">
            </a><br>
            <a href="${championLink}">${championName}</a>
          </td>
          <td style="text-align: center;">${champion.championLevel}</td>
          <td style="text-align: center;">${champion.championPoints}</td>
          <td style="text-align: center;">${champion.championPointsUntilNextLevel}</td>
          <td style="text-align: center;">${tokensHtml}</td>
          <td style="text-align: center;">${gradesHtml}</td>
        </tr>
      `;
    }

    html += '</table>';

    res.send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;