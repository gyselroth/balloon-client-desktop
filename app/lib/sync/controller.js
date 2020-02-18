const path = require('path');

const {BrowserWindow, ipcMain, powerSaveBlocker} = require('electron');
const url = require('url');

const {syncWatcherFactory} = require('@gyselroth/balloon-node-sync');

const StartupCtrl = require('../../ui/startup/controller.js');
const logger = require('../logger.js');
const {fullSyncFactory} = require('@gyselroth/balloon-node-sync');

const env = require('../../env.js');
const clientConfig = require('../config.js');
const globalConfig = require('../global-config.js');
const appState = require('../state.js');

var startup = StartupCtrl(env, clientConfig);

var watcherResumeTimeout;
var fullSyncStartup = false;

module.exports = function(env, tray) {
  var fullSyncWindow;
  var syncPaused = false;
  var mayStart = false;
  var powerSaveBlockerId;
  var watcher;

  function startPowerSaveBlocker() {
    if(!powerSaveBlockerId || powerSaveBlocker.isStarted(powerSaveBlockerId) === false ) {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    }
  }

  function stopPowerSaveBlocker() {
    if(powerSaveBlockerId && powerSaveBlocker.isStarted(powerSaveBlockerId) === true) {
      powerSaveBlocker.stop(powerSaveBlockerId);
    }
  }

  function togglePause() {
    syncPaused = !syncPaused;
    if(syncPaused) {
      //pause
      pause(false).then(() => {
        tray.syncPaused();
      });
    } else {
      //resume
      tray.syncResumed();
      start(false);
    }
  }

  function isPaused() {
    return syncPaused;
  }

  function pause(forceQuit) {
    logger.info('Sync: pause requested');

    if(watcherResumeTimeout) {
      clearTimeout(watcherResumeTimeout);
      watcherResumeTimeout = undefined;
    }

    const watcherPromise = forceQuit ? killWatcher() : pauseWatcher();

    return Promise.all([
      watcherPromise,
      pauseFullSync(forceQuit)
    ]);
  }

  function start(forceFullSync) {
    if(mayStart === false) {
      return logger.info('not starting sync because mayStart is false', {category: 'sync'});
    }

    //return if no user is logged in
    if(!clientConfig.get('loggedin') || !clientConfig.isActiveInstance()) {
      return logger.info('not starting sync because no user logged in', {category: 'sync'});
    }

    //return if no network available
    if(appState.get('onLineState') === false) {
      return logger.info('not starting sync because no network available', {category: 'sync'});
    }

    //return if disconnected
    if(appState.get('disconnected') === true) {
      return logger.info('not starting sync because client is disconnected', {category: 'sync'});
    }

    //return if sync has been paused
    if(syncPaused) {
      return logger.info('not starting sync because sync has been paused', {category: 'sync'});
    }

    if(watcher === undefined) forceFullSync = true;

    if(forceFullSync) {
      startWatcher().then(() => {
        startFullSync();
      });
    } else {
      resumeWatcher(true);
    }
  }

  function startFullSync() {
    //return if sync is already running or is starting up
    if(fullSyncWindow || fullSyncStartup) {
      return logger.info('not starting full sync because it is already running', {category: 'sync'});
    }

    //return if no user is logged in
    if(!clientConfig.get('loggedin') || !clientConfig.isActiveInstance()) {
      return logger.info('not starting full sync because no user logged in', {category: 'sync'});
    }

    //return if no network available
    if(appState.get('onLineState') === false) {
      return logger.info('not starting full sync because no network available', {category: 'sync'});
    }

    //return if disconnected
    if(appState.get('disconnected') === true) {
      return logger.info('not starting full sync because client is disconnected', {category: 'sync'});
    }

    //return if sync has been paused
    if(syncPaused) {
      return logger.info('not starting full sync because sync has been paused', {category: 'sync'});
    }

    fullSyncStartup = true;

    logger.info('starting full sync', {category: 'sync'});
    tray.syncStarted();

    startPowerSaveBlocker();

    pauseWatcher().then(() => {
      startup.preSyncCheck().then(result => {
        logger.info('pre sync check successfull', {category: 'sync'});

        fullSyncWindow = new BrowserWindow({
            width: 1000,
            height: 700,
            show: false,
            frame: true,
            fullscreenable: true,
            resizable: true,
            transparent: false,
            skipTaskbar: true,
            webPreferences: {nodeIntegration: true}
        });

        fullSyncStartup = false;

        fullSyncWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'index.html'),
            protocol: 'file:',
            slashes: true
        }));

        fullSyncWindow.once('ready-to-show', () => {
          if((env.name === 'development')) {
            fullSyncWindow.openDevTools();
            fullSyncWindow.show();
          }
        });

        ipcMain.once('sync-window-loaded', function(){
          fullSyncWindow.webContents.send('secret', clientConfig.getSecret());
        });

        var syncCompleteListener = function(event, err) {
          logger.debug('Sync complete', {category: 'sync'});
          endFullSync();
          if(!err) resumeWatcher(false);
        };

        ipcMain.once('sync-complete', syncCompleteListener);

        ipcMain.once('sync-error', () => {
          ipcMain.removeListener('sync-complete', syncCompleteListener);
        });

        fullSyncWindow.once('closed', (event) => {
          fullSyncWindow = null;

          logger.info('Sync: ended');
          tray.syncEnded();
        });
      }).catch(err => {
        logger.error('pre sync check failed', {
          category: 'sync',
          error: err
        });

        killWatcher().then(() => {
          tray.syncEnded();
          fullSyncStartup = false;

          endFullSync();
        });
      });
    });
  }

  function pauseFullSync(forceQuit) {
    logger.debug('pause full sync requested', {category: 'sync'});

    if(fullSyncWindow) {
      return new Promise(function(resolve, reject) {
        fullSyncWindow.once('closed', (event) => {
          resolve();
        });

        ipcMain.once('sync-stop-result', (event, err) => {
          endFullSync();
        });

        fullSyncWindow.webContents.send('sync-stop', forceQuit);
      });
    } else {
      endFullSync();
      return Promise.resolve();
    }
  }

  function endFullSync() {
    if(fullSyncWindow) {
      if(env.name === 'development') {
        fullSyncWindow.closeDevTools();
      }

      fullSyncWindow.close();
    }

    stopPowerSaveBlocker();
  }

  function startWatcher() {
    return new Promise(function(resolve, reject) {
      var config = clientConfig.getAll(true);
      config.version = globalConfig.get('version');

      Promise.all([
        killWatcher(),
        startup.preSyncCheck(),
      ]).then(result => {
        watcher = new syncWatcherFactory(config, logger);

        watcher.on('error', err => {
          logger.error('Watcher error', {category: 'sync', err});

          switch(err.code) {
            case 'E_BLN_REMOTE_WATCHER_DELTA':
              if(err.origErr && ['E_BLN_API_REQUEST_UNAUTHORIZED', 'E_BLN_API_REQUEST_MFA_REQUIRED'].includes(err.origErr.code)) {
                //TODO pixtron - find a cleaner way to emit watcher errors
                ipcMain.emit('sync-error', {}, err.origErr);
              } else {
                //network problems wait until network is available again
                return;
              }

            break;
            case 'E_BLN_API_REQUEST_UNAUTHORIZED':
              //TODO pixtron - find a cleaner way to emit watcher errors
              ipcMain.emit('sync-error', {}, err);
            break;
            case 'E_BLN_LOCAL_WATCHER_SHUTDOWN':
            default:
              pause(true).then(() => start(true));
          }
        });

        watcher.once('started', () => {
          resolve();
        });

        watcher.start();

        watcher.on('changed', (source) => {
          startFullSync();
        });
      });
    });
  }

  function pauseWatcher() {
    logger.debug('pause watcher requested', {category: 'sync'});

    return new Promise(function(resolve, reject) {
      if(watcher === undefined) return resolve();

      watcher.once('paused', () => {
        resolve();
      });

      watcher.pause();
    });
  }

  function resumeWatcher(immediate) {
    logger.debug('trying to resume watcher', {category: 'sync', immediate});

    return new Promise(function(resolve, reject) {
      function _resume() {
        watcher.once('resumed', () => {
          resolve();
        });

        if(immediate === true) {
          watcher.resume();
        } else {
          watcherResumeTimeout = setTimeout(() => {
            watcher.resume();
          }, ((env.sync && env.sync.interval) || 5) * 1000);
        }
      }

      if(syncPaused !== true) {
        if(!watcher) {
          startWatcher().then(() => {
            _resume();
          });
        } else {
          _resume();
        }
      } else {
        resolve();
      }
    });
  }

  function killWatcher() {
    return new Promise(function(resolve, reject) {
      if(watcher === undefined) return resolve();

      watcher.once('stoped', () => {
        watcher = undefined;

        resolve();
      });

      watcher.stop();
    });
  }

  function updateSelectiveSync(difference, callback) {
    pause(true).then(result => {
      let config = clientConfig.getAll();
      config.accessToken = clientConfig.getSecret();
      config.version = globalConfig.get('version');

      const sync = fullSyncFactory(config, logger.getLogger());

      sync.updateSelectiveSync(difference).then(result => {
        start(true);
        callback(null);
      }, err => {
        logger.error('Could not apply selective sync changes', {category: 'sync', err});
        callback(err);
      });
    }, err => {
      logger.error('Could not pause sync', {category: 'sync', err});
      callback(err);
    });
  }

  function ignoreNewShares(callback) {
    pause(true).then(result => {
      let config = clientConfig.getAll();
      config.accessToken = clientConfig.getSecret();
      config.version = globalConfig.get('version');

      const sync = fullSyncFactory(config, logger.getLogger());

      sync.ignoreNewShares((err, result) => {
        start(false);
        callback(err, result);
      });
    }, err => {
      logger.error('Could not pause sync', {category: 'sync', err});
      callback(err);
    });
  }

  function setMayStart(value) {
    mayStart = value;
  }

  function getMayStart() {
    return mayStart;
  }

  return {
    start,
    pause,
    endFullSync,
    togglePause,
    isPaused,
    updateSelectiveSync,
    ignoreNewShares,
    setMayStart,
    getMayStart,
    resumeWatcher,
    killWatcher
  }
}
