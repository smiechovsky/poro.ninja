let dataSyncInstance = null;
let schedulerInstance = null;

function setDataSync(sync) {
  dataSyncInstance = sync;
}

function getDataSync() {
  return dataSyncInstance;
}

function setScheduler(scheduler) {
  schedulerInstance = scheduler;
}

function getScheduler() {
  return schedulerInstance;
}

module.exports = {
  setDataSync,
  getDataSync,
  setScheduler,
  getScheduler
};


