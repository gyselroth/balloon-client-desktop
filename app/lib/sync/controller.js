const path = require('path');

const {BrowserWindow, ipcMain, powerSaveBlocker} = require('electron');
const url = require('url');

const StartupCtrl = require('../../ui/startup/controller.js');
const logger = require('../logger.js');

const env = require('../../env.js');
const clientConfig = require('../config.js');
var startup = StartupCtrl(env, clientConfig);

var syncTimeout;
var syncStartup = false;

module.exports = function(env, tray, auth) {
  var syncWindow;
  var syncPaused = false;
  var powerSaveBlockerId;

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
      start();
    }
  }

  function isPaused() {
    return syncPaused;
  }

  function pause(forceQuit) {
    logger.info('Sync: pause requested');

    //stop an active sync
    if(syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = undefined;
    }

    if(syncWindow) {
      return new Promise(function(resolve, reject) {
        syncWindow.webContents.send('sync-stop', forceQuit);

        ipcMain.once('sync-stop-result', (event, err) => {
          end(false);

          if(err) return reject(err);

          resolve();
        });

        ipcMain.once('sync-error', (event, error, url, line) => {
          end(false);

          resolve();
        });
      });
    } else {
      stopPowerSaveBlocker();
      return Promise.resolve();
    }
  }

  function start() {

    //return if sync is already running or is starting up
    if(syncWindow || syncStartup) {
      return logger.info('not starting sync because it is already running', {category: 'sync'});
    }

    syncStartup = true;

    //return if no user is logged in
    if(clientConfig.get('loggedin') === false) {
      return logger.info('not starting sync because no user logged in', {category: 'sync'});
    }

    //return if no network available
    if(clientConfig.get('onLineState') === false) {
      return logger.info('not starting because no network available', {category: 'sync'});
    }

    //return if sync has been paused
    if(syncPaused) {
      return logger.info('not starting sync because it has been paused', {category: 'sync'});
    }

    logger.info('starting sync', {category: 'sync'});
    tray.syncStarted();

    startPowerSaveBlocker();

    startup.preSyncCheck().then(result => {
      logger.info('pre sync check successfull', {category: 'sync'});

      syncWindow = new BrowserWindow({
          width: 1000,
          height: 700,
          show: false,
          frame: true,
          fullscreenable: true,
          resizable: true,
          transparent: false,
          skipTaskbar: true
      });

      syncStartup = false;

      syncWindow.loadURL(url.format({
          pathname: path.join(__dirname, 'index.html'),
          protocol: 'file:',
          slashes: true
      }));

      syncWindow.once('ready-to-show', () => {
        if((env.name === 'development')) {
          syncWindow.openDevTools();
          syncWindow.show();
        }
      });

      ipcMain.once('sync-window-loaded', function(){
        syncWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
      });

      syncWindow.once('closed', (event) => {
        syncWindow = null;

        logger.info('Sync: ended');
        tray.syncEnded();
      });
    }).catch(err => {
      logger.error('pre sync check failed', {
        category: 'sync',
        error: err
      });

      tray.syncEnded();
      syncStartup = false;
      end(true);
    });
  }

  function end(scheduleNextSync) {
    if(syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = undefined;
    }

    if(env.name === 'production' && syncPaused !== true && scheduleNextSync === true) {
      //do not set timeout when sync has been paused
      syncTimeout = setTimeout(() => {
        start();
      }, ((env.sync && env.sync.interval) || 5) * 1000);
    }

    if(syncWindow) {
      syncWindow.close();
    }

    stopPowerSaveBlocker();
  }

  return {
    start,
    end,
    pause,
    togglePause,
    isPaused
  }
}
