const {ipcRenderer} = require('electron');

const syncFactory = require('@gyselroth/balloon-node-sync');

const clientConfig = require('../config.js');
const logger = require('../logger.js');
const loggerFactory = require('../logger-factory.js');

var standardLogger = new loggerFactory(clientConfig.getAll(), 'sync.log');
logger.setLogger(standardLogger);

try {
  var syncCompleted = false;
  var sync = syncFactory(clientConfig.getAll(), standardLogger);

  sync.start((err, results) => {
    if(err) {
      logger.error('Sync: finished with error', err);
      ipcRenderer.send('sync-error', err);
    } else {
      logger.info('Sync: Finished successfully', results);
    }

    syncCompleted = true;
    ipcRenderer.send('sync-complete');
  });

  ipcRenderer.on('sync-stop', function(event, forceQuit) {
    sync.stop(forceQuit, (err) => {
      ipcRenderer.send('sync-stop-result', err);
    });
  });

  window.addEventListener('beforeunload', function(event) {
    if(syncCompleted === false) {
      sync.stop(true);
    }
  });
} catch(err) {
  logger.error(err);
  ipcRenderer.send('sync-error', err);
}

window.onerror = function(message, url, line, column, error) {
  logger.error(message, {url, line, column, error});

  sync.cleanup((cleanupErr) => {
    ipcRenderer.send('sync-error', error, url, line);
  });
};
