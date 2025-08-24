const gradeOrder = ['S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-'];

function compareGrades(grade1, grade2) {
  if (!grade1 || !grade2) return false;
  const index1 = gradeOrder.indexOf(grade1);
  const index2 = gradeOrder.indexOf(grade2);
  return index1 !== -1 && index2 !== -1 ? index1 <= index2 : false;
}

function sortAchievedGrades(achievedGrades) {
  if (!achievedGrades || achievedGrades.length === 0) return [];
  return achievedGrades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b));
}

function compareRequiredAndAchievedGrades(requiredGradeList, achievedGrades) {
  if (!requiredGradeList || requiredGradeList.length === 0) return [];
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

module.exports = {
  gradeOrder,
  compareGrades,
  sortAchievedGrades,
  compareRequiredAndAchievedGrades
};


