const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const initializeTables = require('./utils/initDb');
const { logServerStart, logServerError, logLogsLevel } = require('./debugger/server');
const { logLeaderboardsStart } = require('./debugger/leaderboards');
const { warmupAll, scheduleRefresh } = require('./services/leaderboardsWarmup');

dotenv.config();

// Set default LOGS_LEVEL if not defined
if (!process.env.LOGS_LEVEL) {
  process.env.LOGS_LEVEL = '0';
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));
app.use('/Icons', express.static(path.join(__dirname, 'Icons')));
app.use('/css', express.static(path.join(__dirname, 'web', 'css')));
app.use('/js', express.static(path.join(__dirname, 'web', 'js')));

// Routes
const indexRoutes = require('./routes/index');
const overviewRoutes = require('./routes/overview');
const championOverviewRoutes = require('./routes/championOverview');
const historyRoutes = require('./routes/history');
const playedWithRoutes = require('./routes/playedWith');
const searchRoutes = require('./routes/search');
const leaderboardsRoutes = require('./routes/leaderboards');
const vipRoutes = require('./routes/vip');

// Initialize global metrics
global.totalRequests = 0;
global.overviewRequests = 0;
global.searchRequests = 0;
global.historyRequests = 0;
global.totalErrors = 0;
global.error404Count = 0;
global.error500Count = 0;
global.dbQueries = 0;
global.avgQueryDuration = 0;

// Request counter middleware
app.use((req, res, next) => {
  global.totalRequests++;
  
  if (req.path.includes('/overview')) global.overviewRequests++;
  if (req.path.includes('/search')) global.searchRequests++;
  if (req.path.includes('/history')) global.historyRequests++;
  
  next();
});

app.use('/', indexRoutes);
app.use('/search', searchRoutes);
app.use('/', overviewRoutes);
app.use('/', championOverviewRoutes);
app.use('/', historyRoutes);
app.use('/', playedWithRoutes);
app.use('/leaderboards', leaderboardsRoutes);
app.use('/', vipRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mastery-worker',
    version: '1.0.0'
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  const metrics = {
    // System metrics
    mastery_worker_up: 1,
    mastery_worker_start_time: process.uptime(),
    
    // Request metrics
    mastery_worker_requests_total: global.totalRequests || 0,
    mastery_worker_requests_overview: global.overviewRequests || 0,
    mastery_worker_requests_search: global.searchRequests || 0,
    mastery_worker_requests_history: global.historyRequests || 0,
    
    // Error metrics
    mastery_worker_errors_total: global.totalErrors || 0,
    mastery_worker_404_errors: global.error404Count || 0,
    mastery_worker_500_errors: global.error500Count || 0,
    
    // Memory metrics
    mastery_worker_memory_usage_bytes: process.memoryUsage().heapUsed,
    mastery_worker_memory_total_bytes: process.memoryUsage().heapTotal,
    
    // Database metrics
    mastery_worker_db_queries_total: global.dbQueries || 0,
    mastery_worker_db_query_duration_seconds: global.avgQueryDuration || 0
  };

  // Format as Prometheus metrics
  const prometheusMetrics = Object.entries(metrics)
    .map(([key, value]) => `${key} ${value}`)
    .join('\n');

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

const port = process.env.PORT || 3001;

// Error handling middleware
app.use((err, req, res, next) => {
  global.totalErrors++;
  
  if (err.status === 404) global.error404Count++;
  if (err.status === 500) global.error500Count++;
  
  logServerError(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
  global.error404Count++;
  res.status(404).json({ error: 'Not Found' });
});

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    // Initialize database tables
    await initializeTables();
    
    // Start server
    app.listen(port, () => {
      logServerStart(port);
      logLogsLevel(process.env.LOGS_LEVEL);
      logLeaderboardsStart();
    });
    
    // Warmup cache and schedule refresh (only if enabled)
    const cacheEnabled = process.env.LEADERBOARDS_CACHE_ENABLED !== '0';
    if (cacheEnabled) {
      // Fire and forget warmup; do not block server start
      warmupAll();
      scheduleRefresh();
    }

  } catch (error) {
    logServerError(error);
    process.exit(1);
  }
}

// Start the application
initializeApp(); 