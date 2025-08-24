const db = require('../db');
const DataSync = require('../services/dataSync');
const { regionToContinent } = require('../utils/regionMapper');
const { 
  logAddAccountRequest,
  logAddAccountSuccess,
  logAddAccountExists,
  logAddAccountNotFound,
  logForcedSyncStart,
  logForcedSyncComplete
} = require('../debugger/api');
const { 
  logRiotApiError, 
  logAddAccountError, 
  logForceSyncError 
} = require('../debugger/apiRoutes');
const { getScheduler } = require('../utils/globalState');

/**
 * API routes for account management and sync
 */
class ApiRoutes {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Add account endpoint
   */
  async addAccount(req, res) {
    try {
      const { region, nickname, tag } = req.body;
      
      if (!region || !nickname || !tag) {
        return res.status(400).json({ error: 'Missing required fields: region, nickname, tag' });
      }

      logAddAccountRequest(nickname, tag, region);

      // Check if account already exists
      const existingAccount = await db.query(
        'SELECT * FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3',
        [region, nickname, tag]
      );

      if (existingAccount.rows.length > 0) {
        logAddAccountExists(nickname, tag, region);
        return res.json({ 
          message: 'Account already exists', 
          account: existingAccount.rows[0] 
        });
      }

      // Fetch user data from Riot API
      const sync = new DataSync(this.apiKey);
      const continent = regionToContinent(region);
      
      try {
        const userData = await sync.api.fetchUser(continent, nickname, tag);
        
        // Add account to database (lastupdated will be NULL by default)
        const result = await db.query(
          `INSERT INTO AccountsToSync(region, nickname, tag, puuid, continent, createdat)
           VALUES($1,$2,$3,$4,$5,NOW())
           RETURNING *`,
          [region, nickname, tag, userData.puuid, continent]
        );

        logAddAccountSuccess(nickname, tag, region);
        res.json({ 
          message: 'Account added successfully and will be synced by scheduler', 
          account: result.rows[0] 
        });
      } catch (apiError) {
        logAddAccountNotFound(nickname, tag, region);
        logRiotApiError(apiError);
        return res.status(404).json({ 
          error: 'Account not found in Riot API. Please check the region, nickname, and tag.' 
        });
      }
    } catch (error) {
      logAddAccountError(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Force sync endpoint for testing
   */
  async forceSync(req, res) {
    try {
      logForcedSyncStart();
      const sync = new DataSync(this.apiKey);
      const result = await sync.syncAllAccounts();
      logForcedSyncComplete(null, null, result);
      res.json({ 
        message: 'Forced sync completed', 
        result 
      });
    } catch (error) {
      logForceSyncError(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Force sync for a single account
   */
  async forceUserSync(req, res) {
    try {
      const { region, nickname, tag } = req.body || {};
      if (!region || !nickname || !tag) {
        return res.status(400).json({ error: 'Missing required fields: region, nickname, tag' });
      }

      // Lookup account
      const { rows } = await db.query(
        'SELECT id, puuid FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3',
        [region, nickname, tag]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const account = rows[0];

      // Pause or throttle scheduler briefly to free capacity for priority request
      const scheduler = getScheduler();
      if (scheduler && scheduler.stop) {
        scheduler.stop(); // stop continuous loop temporarily
      }

      // Run single-account sync with priority
      logForcedSyncStart(nickname, tag);
      const sync = new DataSync(this.apiKey);
      const newEntries = await sync.syncChampionMastery(region, account.puuid, nickname, tag, true);
      logForcedSyncComplete(nickname, tag, newEntries);

      // Return updated lastupdated_mastery
      const updated = await db.query(
        'SELECT lastupdated_mastery AS lastupdated FROM AccountsToSync WHERE id=$1',
        [account.id]
      );

      const response = {
        message: 'Forced user sync completed',
        region,
        nickname,
        tag,
        newEntries,
        lastupdated: updated.rows[0]?.lastupdated || null
      };

      // Resume scheduler (do not await)
      if (scheduler && scheduler.schedule) {
        setTimeout(() => scheduler.schedule(), 500);
      }

      return res.json(response);
    } catch (error) {
      logForceSyncError(error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Register routes with Express app
   */
  registerRoutes(app) {
    app.post('/api/add-account', (req, res) => this.addAccount(req, res));
    app.post('/api/force-sync', (req, res) => this.forceSync(req, res));
    app.post('/api/force-user-sync', (req, res) => this.forceUserSync(req, res));
    // Force VIP-only sync
    app.post('/api/force-vip-sync', async (req, res) => {
      try {
        const sync = new DataSync(this.apiKey);
        const { rows: vip } = await db.query('SELECT region, nickname, tag, puuid FROM AccountsToSync WHERE vip = TRUE');
        let processed = 0;
        for (const acc of vip) {
          try { await sync.syncChampionMastery(acc.region, acc.puuid, acc.nickname, acc.tag, true); processed++; } catch (_) {}
        }
        return res.json({ processed });
      } catch (e) {
        return res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
}

module.exports = ApiRoutes; 