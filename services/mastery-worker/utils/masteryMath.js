function getMasteryRequirements(level) {
  if (level <= 1) return 0;
  if (level === 2) return 1800;
  if (level === 3) return 6000;
  if (level === 4) return 12600;
  if (level === 5) return 21600;
  if (level === 6) return 31600;
  if (level >= 7) {
    return 31600 + (11000 * (level - 6));
  }
  return 0;
}

function getNextLevelRequirements(currentLevel, currentPoints) {
  const currentLevelReq = getMasteryRequirements(currentLevel);
  const nextLevelReq = getMasteryRequirements(currentLevel + 1);
  const pointsInCurrentLevel = currentPoints - currentLevelReq;
  const pointsNeededForNextLevel = nextLevelReq - currentLevelReq;

  return {
    currentLevelReq,
    nextLevelReq,
    pointsInCurrentLevel,
    pointsNeededForNextLevel,
    progress: (pointsInCurrentLevel / pointsNeededForNextLevel) * 100,
    canLevelUp: pointsInCurrentLevel >= pointsNeededForNextLevel
  };
}

function calculateLevelsCanAdvance(masteryLevel, masteryPoints, tokensEarned, tokensRequired) {
  const hasEnoughTokens = (tokensEarned || 0) >= (tokensRequired || 0);
  let levelsCanAdvance = 0;
  let tempLevel = masteryLevel || 1;
  let tempPoints = masteryPoints || 0;

  while (true) {
    const nextReq = getMasteryRequirements(tempLevel + 1);
    if (tempPoints >= nextReq && hasEnoughTokens) {
      levelsCanAdvance++;
      tempLevel++;
    } else {
      break;
    }
  }

  return levelsCanAdvance;
}

module.exports = {
  getMasteryRequirements,
  getNextLevelRequirements,
  calculateLevelsCanAdvance
};


