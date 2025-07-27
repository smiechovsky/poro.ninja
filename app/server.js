const express = require('express');
const dotenv = require('dotenv');
const updateChampions = require('./services/updateChampions');
const initializeTables = require("./utils/initDb");
const DataSync = require('./services/dataSync');
const db = require('./db');
const { 
  logServerStart, 
  logLogsLevel, 
  logServicesRunning 
} = require('./debugger/server');

dotenv.config();

// Set default LOGS_LEVEL if not defined
if (!process.env.LOGS_LEVEL) {
  process.env.LOGS_LEVEL = '0';
}

const app = express();

app.use(express.json());
app.use('/app', express.static('app'));

app.use('/search', require('./routes/search'));
app.use('/', require('./routes/index'));
app.use(require('./routes/overview'));
app.use(require('./routes/history'));
app.use(require('./routes/championOverview'));

const port = process.env.PORT || 8080;
const syncInterval = parseInt(process.env.SyncInterval || '900', 10);

(async () => {
  try {
    // Debug database config if LOGS_LEVEL >= 2
    db.debugConfig();
    
    await initializeTables();
    await updateChampions();
    
    // Start scheduler
    const sync = new DataSync(process.env.API_KEY);
    sync.schedule(syncInterval);
    
    app.listen(port, () => {
      logServerStart(port);
      logLogsLevel();
      logServicesRunning();
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();