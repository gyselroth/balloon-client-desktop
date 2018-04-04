const {ipcRenderer} = require('electron');

const {fullSyncFactory} = require('@gyselroth/balloon-node-sync');

const env = require('../../env.js');
const clientConfig = require('../config.js');
const logger = require('../logger.js');
const loggerFactory = require('../logger-factory.js');

var standardLogger = new loggerFactory(clientConfig.getAll(), 'sync.log');
logger.setLogger(standardLogger);

var sync;

try {
  var syncCompleted = false;

  ipcRenderer.send('sync-window-loaded');
  ipcRenderer.once('secret', function(event, type, secret) {
    var config = clientConfig.getAll(true);
    config[type] = secret;

    if(env.sync && env.sync.maxConcurentConnections) {
      config['maxConcurentConnections'] = env.sync.maxConcurentConnections;
    }

    sync = fullSyncFactory(config, standardLogger);

    sync.on('transfer-start', function(event) {
      ipcRenderer.send('sync-transfer-start');
      logger.info('transfer started', {category: 'sync'});
    });

    sync.on('transfer-end', function(event) {
      ipcRenderer.send('sync-transfer-end');
      logger.info('Sync transfer ended');
    });

    sync.start((err, results) => {
      if(err) {
        logger.error('finished sync with error', {
          category: 'sync',
          error: err
        });

        ipcRenderer.send('sync-error', err);
      } else {
        logger.info('finished sync successfully', {
          category: 'sync',
          results: results
        });
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
  });
} catch(err) {
  logger.error('sync error occurred', {
    category: 'sync',
    error: err
  });

  ipcRenderer.send('sync-error', err);
}

window.onerror = function(message, url, line, column, error) {
  logger.error(message, {url, line, column, error});

  if(sync && sync.cleanup) {
    sync.cleanup((cleanupErr) => {
      ipcRenderer.send('sync-error', error, url, line, message);
    });
  } else {
    ipcRenderer.send('sync-error', error, url, line, message);
  }

};
