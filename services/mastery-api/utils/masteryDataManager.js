const db = require('../db');

/**
 * Manages champion mastery data database operations
 */
class MasteryDataManager {
  /**
   * Batch insert mastery data for better performance
   */
  static async batchInsertMasteryData(userId, masteryData) {
    if (!masteryData || masteryData.length === 0) {
      return 0;
    }

    // Prepare values for batch insert
    const values = masteryData.map(mastery => 
      `(${userId}, ${mastery.championId}, ${mastery.championLevel}, ${mastery.championPoints}, ${mastery.tokensEarned}, ${mastery.markRequiredForNextLevel}, ${mastery.championPointsUntilNextLevel}, NOW())`
    ).join(',');

    // Batch insert with conflict resolution
    const result = await db.query(
      `INSERT INTO ChampionMasteryHistory(user_id, champion_id, mastery_level, mastery_points, 
       tokens_earned, tokens_required, points_until_next_level, last_seen)
       SELECT * FROM (VALUES ${values}) AS v(user_id, champion_id, mastery_level, mastery_points, 
       tokens_earned, tokens_required, points_until_next_level, last_seen)
       WHERE NOT EXISTS (
         SELECT 1 FROM ChampionMasteryHistory 
         WHERE user_id = v.user_id AND champion_id = v.champion_id AND mastery_level = v.mastery_level 
         AND mastery_points = v.mastery_points AND tokens_earned = v.tokens_earned AND tokens_required = v.tokens_required
       )
       RETURNING id`
    );

    return result.rowCount;
  }

  /**
   * Update lastupdated_mastery timestamp efficiently
   */
  static async updateLastUpdated(puuid) {
    await db.query(
      'UPDATE AccountsToSync SET lastupdated_mastery = NOW() WHERE puuid = $1',
      [puuid]
    );
  }

  /**
   * Get accounts that need syncing
   */
  static async getAccountsToSync() {
    const { rows: totalAccounts } = await db.query('SELECT COUNT(*) as count FROM AccountsToSync');
    const totalCount = parseInt(totalAccounts[0].count);
    
    const { rows: accounts } = await db.query(
      `SELECT region, nickname, tag, puuid FROM AccountsToSync 
       WHERE lastupdated_mastery IS NULL 
          OR lastupdated_mastery < NOW() - INTERVAL '15 minutes'
       ORDER BY 
         CASE WHEN lastupdated_mastery IS NULL THEN 0 ELSE 1 END,
         lastupdated_mastery ASC NULLS FIRST`
    );

    return { accounts, totalCount };
  }
}

module.exports = MasteryDataManager; 