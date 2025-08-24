const RiotApi = require('./riotApi');
const db = require('../db');
const { logMatchAlreadyScanned } = require('../debugger/matchFinder');
const {
  logProcessingAccount,
  logFetchingMatches,
  logMatchesFound,
  logProcessingMatch,
  logFetchingMatchDetails,
  logMatchParticipants,
  logProcessingParticipant,
  logFetchingAccountInfo,
  logAccountFound,
  logAccountExists,
  logAccountAdded,
  logDbError,
  logFinalSummary,
  logRateLimiterStatistics,
  logAccountProcessingError,
  logMatchProcessingError,
  logMatchFetchingError,
  logParticipantProcessingError,
  logMatchDetailsError,
  logCurrentProgressDetails
} = require('../debugger/matchFinder');

class MatchProcessor {
  constructor(apiKey) {
    this.api = new RiotApi(apiKey);
    this.processedPuuid = new Set(); // Track processed PUUIDs in current loop
    this.startTime = Date.now();
    this.processedAccounts = 0;
    this.processedMatches = 0;
    this.totalMatches = 0;
    this.totalParticipants = 0;
    this.newAccountsFound = 0;
    this.existingAccountsFound = 0;
    this.failedParticipants = 0;
  }

  /**
   * Process all accounts in database to find new players
   * @param {number} matchesPerAccount - Number of matches to check per account
   * @param {number} progressLogInterval - Log progress every N accounts
   * @returns {Promise<Object>} Results with uniqueFound and duplicates
   */
  async processAllAccounts(matchesPerAccount = 100, progressLogInterval = 50) {
    this.processedPuuid.clear();
    this.processedAccounts = 0;
    this.processedMatches = 0;
    this.totalMatches = 0;
    this.totalParticipants = 0;
    this.newAccountsFound = 0;
    this.existingAccountsFound = 0;
    this.failedParticipants = 0;
    this.startTime = Date.now();
    
    // Reset global metrics
    global.accountsProcessed = 0;
    global.matchesProcessed = 0;
    global.newAccountsFound = 0;
    global.duplicatesFound = 0;
    global.totalErrors = 0;
    
    let uniqueFound = 0;
    let duplicates = 0;

    try {
      // Get all accounts from database
      const { rows: accounts } = await db.query(
        `SELECT id, region, nickname, tag, puuid, continent
         FROM AccountsToSync
         ORDER BY COALESCE(lastupdated_played_with, createdat) ASC NULLS FIRST`
      );

      // Estimate total matches
      this.totalMatches = accounts.length * matchesPerAccount;

      for (const account of accounts) {
        try {
          const result = await this.processAccount(account, matchesPerAccount, accounts.length);
          uniqueFound += result.uniqueFound;
          duplicates += result.duplicates;
          this.processedAccounts++;

          // Update global metrics
          this.updateGlobalMetrics(result.uniqueFound, result.duplicates, result.processedMatches);

          // Log progress every 50 accounts (reduced from 5 to reduce spam)
          if (this.processedAccounts % progressLogInterval === 0) {
            this.logCurrentProgress(uniqueFound, duplicates, accounts.length);
          }

        } catch (error) {
          logAccountProcessingError(account.nickname, account.tag, error);
          this.processedAccounts++;
          global.totalErrors = (global.totalErrors || 0) + 1;
          continue; // Continue with next account
        }
      }

      // Final summary
      this.logFinalSummary(uniqueFound, duplicates, accounts.length);

      return { uniqueFound, duplicates, totalProcessed: accounts.length };
    } catch (error) {
      logDbError('processAllAccounts', error);
      global.totalErrors = (global.totalErrors || 0) + 1;
      throw error;
    }
  }

  /**
   * Update global metrics for Prometheus
   */
  updateGlobalMetrics(newAccounts, duplicates, processedMatches) {
    global.accountsProcessed = (global.accountsProcessed || 0) + 1;
    global.matchesProcessed = (global.matchesProcessed || 0) + (processedMatches || 0);
    global.newAccountsFound = (global.newAccountsFound || 0) + newAccounts;
    global.duplicatesFound = (global.duplicatesFound || 0) + duplicates;
  }

  /**
   * Log current progress with time estimation
   */
  logCurrentProgress(uniqueFound, duplicates, totalAccounts) {
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const progressPercentage = (this.processedAccounts / totalAccounts) * 100;
    
    if (progressPercentage > 0) {
      const estimatedTotalMinutes = (elapsedMinutes / progressPercentage) * 100;
      const estimatedRemainingMinutes = estimatedTotalMinutes - elapsedMinutes;
      
      logCurrentProgressDetails(
        progressPercentage,
        elapsedMinutes,
        estimatedTotalMinutes,
        this.processedAccounts,
        totalAccounts,
        this.processedMatches,
        this.totalMatches,
        uniqueFound,
        duplicates,
        this.failedParticipants,
        Math.round(estimatedRemainingMinutes)
      );
    }
  }

  /**
   * Log final summary with detailed statistics
   */
  logFinalSummary(uniqueFound, duplicates, totalAccounts) {
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    const rateLimitStats = this.api.rateLimiter.getStats();
    
    logFinalSummary(
      elapsedMinutes,
      this.processedAccounts,
      totalAccounts,
      this.processedMatches,
      this.totalMatches,
      this.totalParticipants,
      this.newAccountsFound,
      this.existingAccountsFound,
      this.failedParticipants,
      uniqueFound,
      duplicates
    );
    
    logRateLimiterStatistics(rateLimitStats, elapsedMinutes);
  }

  /**
   * Process a single account to find new players
   * @param {Object} account - Account object from database
   * @param {number} matchesPerAccount - Number of matches to check
   * @param {number} totalAccounts - Total number of accounts to process
   * @returns {Promise<Object>} Results for this account
   */
  async processAccount(account, matchesPerAccount, totalAccounts) {
    logProcessingAccount(account.nickname, account.tag);
    
    let uniqueFound = 0;
    let duplicates = 0;

    // Prepare progress info for API calls
    const progressInfo = {
      processedAccounts: this.processedAccounts,
      totalAccounts: totalAccounts,
      remainingAccounts: totalAccounts - this.processedAccounts
    };

    try {
      // Get match IDs for this account
      logFetchingMatches(account.nickname, account.tag, matchesPerAccount);
      const matchIds = await this.api.getMatchIds(account.continent, account.puuid, 0, matchesPerAccount, progressInfo);
      logMatchesFound(account.nickname, account.tag, matchIds.length);

      // Process each match
      let processedMatches = 0;
      for (const matchId of matchIds) {
        try {
          const result = await this.processMatch(matchId, account.continent, progressInfo);
          uniqueFound += result.uniqueFound;
          duplicates += result.duplicates;
          processedMatches++;
        } catch (error) {
          logMatchProcessingError(matchId, error);
          continue;
        }
      }

      return { uniqueFound, duplicates, processedMatches };
    } catch (error) {
      logMatchFetchingError(account.nickname, account.tag, error);
      return { uniqueFound: 0, duplicates: 0 };
    }
  }

  /**
   * Process a single match to find new players
   * @param {string} matchId - Match ID
   * @param {string} continent - API continent
   * @param {Object} progressInfo - Progress information for logging
   * @returns {Promise<Object>} Results for this match
   */
  async processMatch(matchId, continent, progressInfo) {
    logProcessingMatch(matchId);
    
    let uniqueFound = 0;
    let duplicates = 0;

    try {
      // Check if match has already been fully scanned using stored expected participants_count
      const { rows: existingStatsRows } = await db.query(
        'SELECT COUNT(*)::int AS cnt, MAX(participants_count)::int AS expected FROM ScannedMatches WHERE match_id = $1',
        [matchId]
      );
      const existingCnt = existingStatsRows[0]?.cnt || 0;
      const expectedCnt = existingStatsRows[0]?.expected || null;
      if (expectedCnt && existingCnt >= expectedCnt) {
        logMatchAlreadyScanned(matchId);
        return { uniqueFound: 0, duplicates: 0 };
      }

      // Get match details (even on partial duplicates to complete per-participant rows)
      logFetchingMatchDetails(matchId);
      const matchData = await this.api.getMatchDetails(continent, matchId, progressInfo);
      
      if (!matchData.metadata || !matchData.metadata.participants) {
        return { uniqueFound: 0, duplicates: 0 };
      }

      const participants = matchData.metadata.participants;
      logMatchParticipants(matchId, participants.length);
      this.totalParticipants += participants.length;

      // Process each participant
      for (const puuid of participants) {
        try {
          const result = await this.processParticipant(puuid, continent, progressInfo);
          uniqueFound += result.uniqueFound;
          duplicates += result.duplicates;
        } catch (error) {
          this.failedParticipants++;
          logParticipantProcessingError(puuid, error);
          continue;
        }
      }

      // After ensuring participants are in DB, update PlayedWith pairs for VIP users (per-match rows)
      try {
        const { rows: participantAccounts } = await db.query(
          'SELECT id, puuid, vip FROM AccountsToSync WHERE puuid = ANY($1::text[])',
          [participants]
        );
        let puuidToAccount = new Map(participantAccounts.map(a => [a.puuid, a.id]));
        const vipAccounts = participantAccounts.filter(a => a.vip === true);
        if (vipAccounts.length > 0) {
          // For each VIP account, create per-match pair rows
          for (const vipAcc of vipAccounts) {
            for (const other of participantAccounts) {
              if (other.id === vipAcc.id) continue;
              await db.query(
                `INSERT INTO PlayedWith (user_id, other_user_id, match_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, other_user_id, match_id) DO NOTHING`,
                [vipAcc.id, other.id, matchId]
              );
            }
            // Update lastupdated_played_with for the VIP account
            await db.query('UPDATE AccountsToSync SET lastupdated_played_with = NOW() WHERE id = $1', [vipAcc.id]);
          }
        }
      } catch (pairErr) {
        // Non-fatal; continue processing
      }

      // Record the scanned match per participant (idempotent)
      // Ensure mapping exists even if the VIP section above errored
      if (typeof puuidToAccount === 'undefined' || puuidToAccount === null) {
        try {
          const { rows: participantAccounts } = await db.query(
            'SELECT id, puuid FROM AccountsToSync WHERE puuid = ANY($1::text[])',
            [participants]
          );
          var puuidToAccount = new Map(participantAccounts.map(a => [a.puuid, a.id]));
        } catch (_) {
          var puuidToAccount = null;
        }
      }
      for (const puuid of participants) {
        const accountId = puuidToAccount ? puuidToAccount.get(puuid) : null;
        await db.query(
          `INSERT INTO ScannedMatches (match_id, continent, participant_puuid, account_id, participants_count, new_accounts_found)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (match_id, participant_puuid) DO NOTHING`,
          [matchId, continent, puuid, accountId || null, participants.length, uniqueFound]
        );
      }

      this.processedMatches++;
      return { uniqueFound, duplicates };
    } catch (error) {
      logMatchDetailsError(matchId, error);
      return { uniqueFound: 0, duplicates: 0 };
    }
  }

  /**
   * Process a single participant to check if they're a new player
   * @param {string} puuid - Player's PUUID
   * @param {string} continent - API continent
   * @param {Object} progressInfo - Progress information for logging
   * @returns {Promise<Object>} Results for this participant
   */
  async processParticipant(puuid, continent, progressInfo) {
    // Skip if we've already processed this PUUID in this loop
    if (this.processedPuuid.has(puuid)) {
      return { uniqueFound: 0, duplicates: 1 };
    }

    this.processedPuuid.add(puuid);
    logProcessingParticipant(puuid);

    try {
      // Check if account already exists in database
      const { rows: existingAccounts } = await db.query(
        'SELECT id FROM AccountsToSync WHERE puuid = $1',
        [puuid]
      );

      if (existingAccounts.length > 0) {
        this.existingAccountsFound++;
        logAccountExists('existing', 'account');
        return { uniqueFound: 0, duplicates: 1 };
      }

      // Get account info from Riot API
      logFetchingAccountInfo(puuid);
      const accountInfo = await this.api.getAccountInfo(continent, puuid, progressInfo);
      
      if (!accountInfo.gameName || !accountInfo.tagLine) {
        this.failedParticipants++;
        return { uniqueFound: 0, duplicates: 0 };
      }

      logAccountFound(accountInfo.gameName, accountInfo.tagLine);

      // Determine region from continent
      const region = this.continentToRegion(continent);

      // Add new account to database (lastupdated will be NULL by default)
      await db.query(
        `INSERT INTO AccountsToSync (region, nickname, tag, puuid, continent, createdat)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (puuid) DO NOTHING`,
        [region, accountInfo.gameName, accountInfo.tagLine, puuid, continent]
      );

      // Check if account was actually added (not a duplicate)
      const { rows: addedAccounts } = await db.query(
        'SELECT id FROM AccountsToSync WHERE puuid = $1',
        [puuid]
      );

      if (addedAccounts.length > 0) {
        this.newAccountsFound++;
        logAccountAdded(accountInfo.gameName, accountInfo.tagLine);
        return { uniqueFound: 1, duplicates: 0 };
      } else {
        this.existingAccountsFound++;
        logAccountExists(accountInfo.gameName, accountInfo.tagLine);
        return { uniqueFound: 0, duplicates: 1 };
      }

    } catch (error) {
      this.failedParticipants++;
      logParticipantProcessingError(puuid, error);
      return { uniqueFound: 0, duplicates: 0 };
    }
  }

  /**
   * Convert continent to region for database storage
   * @param {string} continent - API continent
   * @returns {string} Game region
   */
  continentToRegion(continent) {
    // Default to eun1 for europe, you might want to make this more sophisticated
    const continentMap = {
      'europe': 'eun1',
      'americas': 'na1',
      'asia': 'kr',
      'sea': 'oc1'
    };
    
    return continentMap[continent] || 'eun1';
  }
}

module.exports = MatchProcessor; 