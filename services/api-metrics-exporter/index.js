require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 9107;

// Database connection
const db = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'poro_ninja',
  user: process.env.DB_USER || process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Service URLs
const ACCOUNTS_FINDER_URL = process.env.ACCOUNTS_FINDER_URL || 'http://accounts-finder:3002';
const MASTERY_API_URL = process.env.MASTERY_API_URL || 'http://mastery-api:8080';

// Cache for metrics to avoid overwhelming the services
let metricsCache = {
  accountsFinder: null,
  masteryApi: null,
  database: null,
  lastUpdate: 0
};

const CACHE_DURATION = 3000; // 3 seconds cache for near-realtime widgets

// Derived usage accumulators to make endpoint charts change over time
const usageState = {
  lastUsed: new Map(),
  endpointUsedTotal: new Map(),
  serviceUsedTotal: new Map(),
};

function updateUsageCounters(service, endpoint, limit, remaining) {
  const used = Math.max(0, (limit || 0) - (remaining || 0));
  const key = `${service}:${endpoint || '__service__'}`;
  const serviceKey = `${service}`;
  const last = usageState.lastUsed.get(key) ?? used;
  let delta = used - last;
  if (delta < 0) delta = 0; // window reset
  usageState.lastUsed.set(key, used);
  if (delta > 0) {
    usageState.endpointUsedTotal.set(key, (usageState.endpointUsedTotal.get(key) || 0) + delta);
    usageState.serviceUsedTotal.set(serviceKey, (usageState.serviceUsedTotal.get(serviceKey) || 0) + delta);
  }
}

/**
 * Fetch metrics from accounts-finder service
 */
async function fetchAccountsFinderMetrics() {
  try {
    const response = await axios.get(`${ACCOUNTS_FINDER_URL}/metrics`, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('[API-METRICS] [LOGS-LEVEL:1] Failed to fetch accounts-finder metrics:', error.message);
    return null;
  }
}

/**
 * Fetch metrics from mastery-api service
 */
async function fetchMasteryApiMetrics() {
  try {
    const response = await axios.get(`${MASTERY_API_URL}/metrics`, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('[API-METRICS] [LOGS-LEVEL:1] Failed to fetch mastery-api metrics:', error.message);
    return null;
  }
}

/**
 * Fetch account synchronization metrics from database
 */
async function fetchDatabaseMetrics() {
  try {
    const totalsQuery = `
      SELECT 
        COUNT(*) AS total_accounts,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '1 hour') AS synced_1h,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '3 hour') AS synced_3h,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '6 hour') AS synced_6h,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '12 hour') AS synced_12h,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '24 hour') AS synced_24h,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '2 day') AS synced_2d,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '3 day') AS synced_3d,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '5 day') AS synced_5d,
        COUNT(*) FILTER (WHERE COALESCE(lastupdated_mastery, lastupdated) >= NOW() - INTERVAL '7 day') AS synced_7d
      FROM accountstosync;
    `;

    const masteryCountQuery = `SELECT COUNT(*)::bigint AS total_mastery_records FROM championmasteryhistory;`;
    const scannedMatchesQuery = `SELECT continent, COUNT(*)::bigint AS count FROM scannedmatches GROUP BY continent;`;

    const [totalsRes, masteryRes, matchesRes] = await Promise.all([
      db.query(totalsQuery),
      db.query(masteryCountQuery),
      db.query(scannedMatchesQuery)
    ]);

    return {
      ...totalsRes.rows[0],
      total_mastery_records: masteryRes.rows[0]?.total_mastery_records || 0,
      scanned_matches_by_continent: matchesRes.rows || []
    };
  } catch (error) {
    console.error('[API-METRICS] [LOGS-LEVEL:1] Failed to fetch database metrics:', error.message);
    return null;
  }
}

/**
 * Parse Prometheus metrics from service response
 */
function parsePrometheusMetrics(metricsText) {
  const metrics = {};
  if (!metricsText) return metrics;
  
  const lines = metricsText.split('\n');
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split(' ');
      if (key && value) {
        metrics[key.trim()] = parseFloat(value.trim());
      }
    }
  }
  return metrics;
}

/**
 * Generate combined Prometheus metrics
 */
function generatePrometheusMetrics() {
  const now = Date.now();
  
  // Parse service metrics
  const accountsFinderMetrics = parsePrometheusMetrics(metricsCache.accountsFinder);
  const masteryApiMetrics = parsePrometheusMetrics(metricsCache.masteryApi);
  const dbMetrics = metricsCache.database || {};
  
  // Calculate combined API request metrics
  // Remaining is not "used"; compute used as limit - remaining
  const afLimit = accountsFinderMetrics?.accounts_finder_rate_limit_max_requests || 6000;
  const maLimit = masteryApiMetrics?.mastery_api_rate_limit_max_requests || 6000;
  const accountsFinderRemaining = accountsFinderMetrics?.accounts_finder_rate_limit_remaining || 0;
  const masteryApiRemaining = masteryApiMetrics?.mastery_api_rate_limit_remaining || 0;
  const accountsFinderUsed = Math.max(afLimit - accountsFinderRemaining, 0);
  const masteryApiUsed = Math.max(maLimit - masteryApiRemaining, 0);
  const totalRemaining = accountsFinderRemaining + masteryApiRemaining;

  // Update accumulators for service and endpoints to visualize usage over time
  updateUsageCounters('accounts-finder', null, afLimit, accountsFinderRemaining);
  updateUsageCounters('mastery-api', null, maLimit, masteryApiRemaining);
  updateUsageCounters('accounts-finder', 'match-ids', accountsFinderMetrics?.accounts_finder_match_ids_limit || 2000, accountsFinderMetrics?.accounts_finder_match_ids_remaining || 0);
  updateUsageCounters('accounts-finder', 'match-details', accountsFinderMetrics?.accounts_finder_match_details_limit || 2000, accountsFinderMetrics?.accounts_finder_match_details_remaining || 0);
  updateUsageCounters('accounts-finder', 'account-info', accountsFinderMetrics?.accounts_finder_account_info_limit || 20000, accountsFinderMetrics?.accounts_finder_account_info_remaining || 0);
  updateUsageCounters('mastery-api', 'mastery', masteryApiMetrics?.mastery_api_mastery_limit || 20000, masteryApiMetrics?.mastery_api_mastery_remaining || 0);
  
  // Calculate combined rate limit errors
  const accountsFinderErrors = accountsFinderMetrics?.accounts_finder_rate_limit_errors_total || 0;
  const masteryApiErrors = masteryApiMetrics?.mastery_api_rate_limit_errors_total || 0;
  const totalErrors = accountsFinderErrors + masteryApiErrors;
  
  // Get individual endpoint metrics
  const accountsFinderMatchIds = accountsFinderMetrics?.accounts_finder_match_ids_remaining || 0;
  const accountsFinderMatchDetails = accountsFinderMetrics?.accounts_finder_match_details_remaining || 0;
  const accountsFinderAccountInfo = accountsFinderMetrics?.accounts_finder_account_info_remaining || 0;
  const masteryApiMastery = masteryApiMetrics?.mastery_api_mastery_remaining || 0;
  
  // Generate Prometheus format metrics
  const prometheusMetrics = [
    // API Request metrics - Global
    `# HELP api_requests_remaining Remaining API requests per service`,
    `# TYPE api_requests_remaining gauge`,
    `api_requests_remaining{service="accounts-finder"} ${accountsFinderRemaining}`,
    `api_requests_remaining{service="mastery-api"} ${masteryApiRemaining}`,
    `api_requests_remaining{service="total"} ${totalRemaining}`,
    
    // API Request limits - Global
    `# HELP api_requests_limit Maximum API requests per service`,
    `# TYPE api_requests_limit gauge`,
    `api_requests_limit{service="accounts-finder"} ${afLimit}`,
    `api_requests_limit{service="mastery-api"} ${maLimit}`,
    `api_requests_limit{service="total"} ${afLimit + maLimit}`,
    
    // API Request usage percentage - Global
    `# HELP api_requests_usage_percent API request usage percentage per service`,
    `# TYPE api_requests_usage_percent gauge`,
    `api_requests_usage_percent{service="accounts-finder"} ${afLimit ? (accountsFinderUsed / afLimit) * 100 : 0}`,
    `api_requests_usage_percent{service="mastery-api"} ${maLimit ? (masteryApiUsed / maLimit) * 100 : 0}`,
    `api_requests_usage_percent{service="total"} ${(afLimit + maLimit) ? ((accountsFinderUsed + masteryApiUsed) / (afLimit + maLimit)) * 100 : 0}`,

    // Derived counters: accumulated USED per service and per endpoint
    `# HELP api_requests_used_total Accumulated API requests used per service (derived)`,
    `# TYPE api_requests_used_total counter`,
    `api_requests_used_total{service="accounts-finder"} ${usageState.serviceUsedTotal.get('accounts-finder') || 0}`,
    `api_requests_used_total{service="mastery-api"} ${usageState.serviceUsedTotal.get('mastery-api') || 0}`,
    `api_requests_used_total{service="total"} ${((usageState.serviceUsedTotal.get('accounts-finder') || 0) + (usageState.serviceUsedTotal.get('mastery-api') || 0))}`,

    `# HELP api_endpoint_requests_used_total Accumulated API requests used per endpoint (derived)`,
    `# TYPE api_endpoint_requests_used_total counter`,
    `api_endpoint_requests_used_total{service="accounts-finder",endpoint="match-ids"} ${usageState.endpointUsedTotal.get('accounts-finder:match-ids') || 0}`,
    `api_endpoint_requests_used_total{service="accounts-finder",endpoint="match-details"} ${usageState.endpointUsedTotal.get('accounts-finder:match-details') || 0}`,
    `api_endpoint_requests_used_total{service="accounts-finder",endpoint="account-info"} ${usageState.endpointUsedTotal.get('accounts-finder:account-info') || 0}`,
    `api_endpoint_requests_used_total{service="mastery-api",endpoint="mastery"} ${usageState.endpointUsedTotal.get('mastery-api:mastery') || 0}`,
    `api_endpoint_requests_used_total{service="mastery-api",endpoint="priority-force"} ${masteryApiMetrics?.mastery_api_mastery_requests_priority_total || 0}`,
    
    // API Request metrics - Individual endpoints
    `# HELP api_endpoint_requests_remaining Remaining API requests per endpoint`,
    `# TYPE api_endpoint_requests_remaining gauge`,
    `api_endpoint_requests_remaining{service="accounts-finder",endpoint="match-ids"} ${accountsFinderMatchIds}`,
    `api_endpoint_requests_remaining{service="accounts-finder",endpoint="match-details"} ${accountsFinderMatchDetails}`,
    `api_endpoint_requests_remaining{service="accounts-finder",endpoint="account-info"} ${accountsFinderAccountInfo}`,
    `api_endpoint_requests_remaining{service="mastery-api",endpoint="mastery"} ${masteryApiMastery}`,
    
    // API Request limits - Individual endpoints
    `# HELP api_endpoint_requests_limit Maximum API requests per endpoint`,
    `# TYPE api_endpoint_requests_limit gauge`,
    `api_endpoint_requests_limit{service="accounts-finder",endpoint="match-ids"} ${accountsFinderMetrics?.accounts_finder_match_ids_limit || 2000}`,
    `api_endpoint_requests_limit{service="accounts-finder",endpoint="match-details"} ${accountsFinderMetrics?.accounts_finder_match_details_limit || 2000}`,
    `api_endpoint_requests_limit{service="accounts-finder",endpoint="account-info"} ${accountsFinderMetrics?.accounts_finder_account_info_limit || 20000}`,
    `api_endpoint_requests_limit{service="mastery-api",endpoint="mastery"} ${masteryApiMetrics?.mastery_api_mastery_limit || 20000}`,
    
    // Rate limit errors
    `# HELP api_rate_limit_errors_total Total rate limit errors per service`,
    `# TYPE api_rate_limit_errors_total counter`,
    `api_rate_limit_errors_total{service="accounts-finder"} ${accountsFinderErrors}`,
    `api_rate_limit_errors_total{service="mastery-api"} ${masteryApiErrors}`,
    `api_rate_limit_errors_total{service="total"} ${totalErrors}`,
    
    // Account synchronization metrics
    `# HELP accounts_total Total accounts in database`,
    `# TYPE accounts_total gauge`,
    `accounts_total ${Number(dbMetrics.total_accounts || 0)}`,
    
    `# HELP accounts_synced_1h Accounts synced in last 1 hour`,
    `# TYPE accounts_synced_1h gauge`,
    `accounts_synced_1h ${dbMetrics?.synced_1h || 0}`,
    
    `# HELP accounts_synced_3h Accounts synced in last 3 hours`,
    `# TYPE accounts_synced_3h gauge`,
    `accounts_synced_3h ${dbMetrics?.synced_3h || 0}`,
    
    `# HELP accounts_synced_6h Accounts synced in last 6 hours`,
    `# TYPE accounts_synced_6h gauge`,
    `accounts_synced_6h ${dbMetrics?.synced_6h || 0}`,
    
    `# HELP accounts_synced_12h Accounts synced in last 12 hours`,
    `# TYPE accounts_synced_12h gauge`,
    `accounts_synced_12h ${dbMetrics?.synced_12h || 0}`,
    
    `# HELP accounts_synced_24h Accounts synced in last 24 hours`,
    `# TYPE accounts_synced_24h gauge`,
    `accounts_synced_24h ${dbMetrics?.synced_24h || 0}`,
    
    `# HELP accounts_synced_2d Accounts synced in last 2 days`,
    `# TYPE accounts_synced_2d gauge`,
    `accounts_synced_2d ${dbMetrics?.synced_2d || 0}`,
    
    `# HELP accounts_synced_3d Accounts synced in last 3 days`,
    `# TYPE accounts_synced_3d gauge`,
    `accounts_synced_3d ${dbMetrics?.synced_3d || 0}`,
    
    `# HELP accounts_synced_5d Accounts synced in last 5 days`,
    `# TYPE accounts_synced_5d gauge`,
    `accounts_synced_5d ${dbMetrics?.synced_5d || 0}`,
    
    `# HELP accounts_synced_7d Accounts synced in last 7 days`,
    `# TYPE accounts_synced_7d gauge`,
    `accounts_synced_7d ${dbMetrics?.synced_7d || 0}`,
    
    // Synchronization percentages
    `# HELP accounts_sync_percentage_1h Percentage of accounts synced in last 1 hour`,
    `# TYPE accounts_sync_percentage_1h gauge`,
    `accounts_sync_percentage_1h ${dbMetrics?.total_accounts ? (dbMetrics.synced_1h / dbMetrics.total_accounts) * 100 : 0}`,
    
    `# HELP accounts_sync_percentage_24h Percentage of accounts synced in last 24 hours`,
    `# TYPE accounts_sync_percentage_24h gauge`,
    `accounts_sync_percentage_24h ${dbMetrics?.total_accounts ? (dbMetrics.synced_24h / dbMetrics.total_accounts) * 100 : 0}`,
    
    `# HELP accounts_sync_percentage_7d Percentage of accounts synced in last 7 days`,
    `# TYPE accounts_sync_percentage_7d gauge`,
    `accounts_sync_percentage_7d ${dbMetrics?.total_accounts ? (dbMetrics.synced_7d / dbMetrics.total_accounts) * 100 : 0}`,
    
    // Service health metrics
    `# HELP api_metrics_exporter_up Service health status`,
    `# TYPE api_metrics_exporter_up gauge`,
    `api_metrics_exporter_up 1`,
    
    `# HELP api_metrics_exporter_last_update_timestamp Last metrics update timestamp`,
    `# TYPE api_metrics_exporter_last_update_timestamp gauge`,
    `api_metrics_exporter_last_update_timestamp ${now}`
  ];

  // Database totals for Grafana
  const totalMasteryRecords = Number(dbMetrics.total_mastery_records || 0);
  const scannedMatchesByContinent = dbMetrics.scanned_matches_by_continent || [];

  prometheusMetrics.push(`# HELP db_total_mastery_records Total rows in ChampionMasteryHistory`);
  prometheusMetrics.push(`# TYPE db_total_mastery_records gauge`);
  prometheusMetrics.push(`db_total_mastery_records ${totalMasteryRecords}`);

  prometheusMetrics.push(`# HELP db_scanned_matches_total Scanned matches per continent`);
  prometheusMetrics.push(`# TYPE db_scanned_matches_total gauge`);
  for (const row of scannedMatchesByContinent) {
    const continent = row.continent || 'unknown';
    const count = Number(row.count || 0);
    prometheusMetrics.push(`db_scanned_matches_total{continent="${continent}"} ${count}`);
  }

  return prometheusMetrics.join('\n');
}

/**
 * Metrics endpoint for Prometheus
 */
app.get('/metrics', async (req, res) => {
  try {
    // Fetch fresh metrics if cache is stale
    const now = Date.now();
    if (!metricsCache.lastUpdate || (now - metricsCache.lastUpdate) >= CACHE_DURATION) {
      console.log('[API-METRICS] [LOGS-LEVEL:1] Fetching fresh metrics from services');
      
      const [accountsFinderData, masteryApiData, dbData] = await Promise.allSettled([
        fetchAccountsFinderMetrics(),
        fetchMasteryApiMetrics(),
        fetchDatabaseMetrics()
      ]);
      
      // Preserve last good values if a fetch failed to avoid zero spikes in Grafana
      metricsCache = {
        accountsFinder: accountsFinderData.status === 'fulfilled' ? accountsFinderData.value : metricsCache.accountsFinder,
        masteryApi: masteryApiData.status === 'fulfilled' ? masteryApiData.value : metricsCache.masteryApi,
        database: dbData.status === 'fulfilled' ? dbData.value : metricsCache.database,
        lastUpdate: now
      };
    }
    
    const prometheusMetrics = generatePrometheusMetrics();
    
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
    
  } catch (error) {
    console.error('[API-METRICS] [LOGS-LEVEL:1] Error generating metrics:', error.message);
    res.status(500).send('# Error generating metrics\n');
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api-metrics-exporter',
    version: '1.0.0',
    lastUpdate: metricsCache.lastUpdate
  });
});

/**
 * Start the server
 */
app.listen(port, () => {
  console.log(`[API-METRICS] [LOGS-LEVEL:0] API Metrics Exporter started on port ${port}`);
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('[API-METRICS] [LOGS-LEVEL:0] Shutting down gracefully');
  await db.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[API-METRICS] [LOGS-LEVEL:0] Shutting down gracefully');
  await db.end();
  process.exit(0);
}); 