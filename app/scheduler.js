const dotenv = require('dotenv');
const DataSync = require('./services/dataSync');

dotenv.config();

const sync = new DataSync(process.env.API_KEY);
const interval = parseInt(process.env.SyncInterval || '900', 10);

sync.schedule(interval);