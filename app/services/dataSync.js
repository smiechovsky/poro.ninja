const db = require('../db');
const RiotApi = require('./riotApi');
const { 
  logSyncStart, 
  logAccountSyncStart, 
  logChampionsFetched, 
  logAccountSyncComplete, 
  logSyncComplete, 
  logNextSyncTime 
} = require('../debugger/scheduler');

class DataSync {
  constructor(apiKey) {
    this.api = new RiotApi(apiKey);
  }

  async upsertUser(puuid, region, nickname, tag, continent) {
    const res = await db.query(
      `INSERT INTO AccountsToSync(region, nickname, tag, puuid, continent, lastupdated, createdat)
       VALUES($1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT (puuid) DO UPDATE SET lastupdated=NOW()
       RETURNING id`,
      [region, nickname, tag, puuid, continent]
    );
    return res.rows[0].id;
  }

  async upsertMastery(userId, data) {
    const q = `INSERT INTO ChampionMasteryHistory(user_id, champion_id, mastery_level, mastery_points, tokens_earned,
        points_since_last_level, points_until_next_level, tokens_required, first_seen, last_seen)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
      ON CONFLICT ON CONSTRAINT unique_history DO UPDATE SET last_seen=NOW();`;
    const p = [userId, data.championId, data.championLevel, data.championPoints,
      data.tokensEarned || 0, data.championPointsSinceLastLevel, data.championPointsUntilNextLevel, data.markRequiredForNextLevel];
    await db.query(q, p);
  }

  async upsertGrades(userId, championId, achieved, required, newGrade) {
    const q = `INSERT INTO ChampionGrades(user_id, champion_id, achieved_grades, required_grades, new_grade, first_seen, last_seen)
      VALUES($1,$2,$3,$4,$5,NOW(),NOW())
      ON CONFLICT (user_id,champion_id) DO UPDATE SET
        achieved_grades=COALESCE($3,ChampionGrades.achieved_grades),
        required_grades=COALESCE($4,ChampionGrades.required_grades),
        new_grade=COALESCE($5,ChampionGrades.new_grade),
        last_seen=NOW();`;
    await db.query(q, [userId, championId, achieved || null, required || null, newGrade || null]);
  }

  async syncChampionMastery(region, puuid, nickname, tag) {
    logAccountSyncStart(nickname, tag, region);
    
    const data = await this.api.fetchMastery(region, puuid);
    logChampionsFetched(data.length);
    
    const continent = this.regionToContinent(region);
    const userId = await this.upsertUser(puuid, region, nickname, tag, continent);

    for (const champ of data) {
      await this.upsertMastery(userId, champ);
      
      // milestoneGrades is an array of strings, not an object
      // championSeasonMilestone indicates how many milestones were achieved
      const achieved = Array.isArray(champ.milestoneGrades) ? champ.milestoneGrades : [];
      
      // nextSeasonMilestone.requireGradeCounts is an object with grade counts
      const required = champ.nextSeasonMilestone?.requireGradeCounts ?
        Object.entries(champ.nextSeasonMilestone.requireGradeCounts).flatMap(([grade, count]) => Array(count).fill(grade)) : [];
      
      await this.upsertGrades(userId, champ.championId, achieved.length > 0 ? achieved.join(',') : null, required.length > 0 ? required.join(',') : null, champ.newGrade || null);
    }
    
    logAccountSyncComplete(nickname, tag, region, 0); // 0 new entries for overview sync
  }

  async syncAllAccounts() {
    const res = await db.query('SELECT * FROM AccountsToSync');
    const totalAccounts = res.rows.length;
    let totalNewEntries = 0;
    let processed = 0;
    
    logSyncStart(totalAccounts);
    
    for (const acc of res.rows) {
      logAccountSyncStart(acc.nickname, acc.tag, acc.region);
      
      const before = await db.query(
        'SELECT COUNT(*) FROM ChampionMasteryHistory WHERE user_id = (SELECT id FROM AccountsToSync WHERE puuid=$1)',
        [acc.puuid]
      );
      
      const data = await this.api.fetchMastery(acc.region, acc.puuid);
      logChampionsFetched(data.length);
      
      const continent = this.regionToContinent(acc.region);
      const userId = await this.upsertUser(acc.puuid, acc.region, acc.nickname, acc.tag, continent);
      
      for (const champ of data) {
        await this.upsertMastery(userId, champ);
        
        // milestoneGrades is an array of strings, not an object
        // championSeasonMilestone indicates how many milestones were achieved
        const achieved = Array.isArray(champ.milestoneGrades) ? champ.milestoneGrades : [];
        
        // nextSeasonMilestone.requireGradeCounts is an object with grade counts
        const required = champ.nextSeasonMilestone?.requireGradeCounts ?
          Object.entries(champ.nextSeasonMilestone.requireGradeCounts).flatMap(([grade, count]) => Array(count).fill(grade)) : [];
        
        await this.upsertGrades(userId, champ.championId, achieved.length > 0 ? achieved.join(',') : null, required.length > 0 ? required.join(',') : null, champ.newGrade || null);
      }
      
      const after = await db.query(
        'SELECT COUNT(*) FROM ChampionMasteryHistory WHERE user_id = (SELECT id FROM AccountsToSync WHERE puuid=$1)',
        [acc.puuid]
      );
      
      const newEntries = parseInt(after.rows[0].count) - parseInt(before.rows[0].count);
      totalNewEntries += newEntries;
      processed++;
      
      logAccountSyncComplete(acc.nickname, acc.tag, acc.region, newEntries);
    }
    
    logSyncComplete(processed, totalAccounts, totalNewEntries);
  }

  schedule(interval) {
    const nextSyncTime = () => {
      const now = new Date();
      const next = new Date(now.getTime() + interval * 1000);
      return next.toLocaleTimeString();
    };
    
    const runSync = async () => {
      await this.syncAllAccounts();
      logNextSyncTime(nextSyncTime());
      setTimeout(runSync, interval * 1000);
    };
    
    runSync();
  }

  regionToContinent(region) {
    if(['eun1','euw1','tr1','ru'].includes(region)) return 'europe';
    if(['na1','la1','la2'].includes(region)) return 'americas';
    return 'asia';
  }
}

module.exports = DataSync;