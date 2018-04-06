const path = require('path');

const {BrowserWindow, ipcMain, powerSaveBlocker} = require('electron');
const url = require('url');

const {syncWatcherFactory} = require('@gyselroth/balloon-node-sync');

const StartupCtrl = require('../../ui/startup/controller.js');
const logger = require('../logger.js');
const {fullSyncFactory} = require('@gyselroth/balloon-node-sync');

const env = require('../../env.js');
const clientConfig = require('../config.js');
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
      fullSyncStartup = false;
      return logger.info('not starting full sync because it is already running', {category: 'sync'});
    }

    fullSyncStartup = true;

    //return if no user is logged in
    if(!clientConfig.get('loggedin') || !clientConfig.isActiveInstance()) {
      fullSyncStartup = false;
      return logger.info('not starting full sync because no user logged in', {category: 'sync'});
    }

    //return if no network available
    if(appState.get('onLineState') === false) {
      fullSyncStartup = false;
      return logger.info('not starting full sync because no network available', {category: 'sync'});
    }

    //return if sync has been paused
    if(syncPaused) {
      fullSyncStartup = false;
      return logger.info('not starting full sync because sync has been paused', {category: 'sync'});
    }

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
            skipTaskbar: true
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
          fullSyncWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
        });

        ipcMain.once('sync-complete', () => {
          endFullSync();
          resumeWatcher(false);
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
      const config = clientConfig.getAll(true);

      killWatcher().then(result => {
        watcher = new syncWatcherFactory(config, logger);

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
    return new Promise(function(resolve, reject) {
      if(watcher === undefined) return resolve();

      watcher.once('paused', () => {
        resolve();
      });

      watcher.pause();
    });
  }

  function resumeWatcher(immediate) {
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
    pause().then(result => {
      let config = clientConfig.getAll();
      config[clientConfig.getSecretType()] = clientConfig.getSecret();

      const sync = fullSyncFactory(config, logger.getLogger());

      sync.updateSelectiveSync(difference).then(result => {
        start();
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

  function setMayStart(value) {
    mayStart = value;
  }

  return {
    start,
    pause,
    endFullSync,
    togglePause,
    isPaused,
    updateSelectiveSync,
    setMayStart,
    resumeWatcher,
    killWatcher
  }
}
