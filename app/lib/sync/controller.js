const path = require('path');

const {BrowserWindow, ipcMain, powerSaveBlocker} = require('electron');
const url = require('url');

const StartupCtrl = require('../../ui/startup/controller.js');
const logger = require('../logger.js');

const env = require('../../env.js');
const clientConfig = require('../config.js');
var startup = StartupCtrl(env, clientConfig);

var syncTimeout;

module.exports = function(env, tray) {
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
          if(err) return reject(err);

          stopPowerSaveBlocker();

          resolve();
        });
      });
    } else {
      stopPowerSaveBlocker();
      return Promise.resolve();
    }
  }

  function start() {
    //return if no user is logged in
    if(clientConfig.get('loggedin') === false) return logger.info('Sync: not starting sync because no user logged in');

    //return if no network available
    if(clientConfig.get('onLineState') === false) return logger.info('Sync: not starting because no network available');

    //return if sync has been paused
    if(syncPaused) return logger.info('Sync: not starting sync because it has been paused')

    //return if sync is already running
    if(syncWindow) return logger.info('Sync: not starting sync because it is already running');

    logger.info('Sync: starting sync');
    tray.syncStarted();

    startPowerSaveBlocker();

    startup.preSyncCheck().then(result => {
      logger.info('Sync: pre sync check successfull');

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

      ipcMain.on('sync-window-loaded', function(){
        syncWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
      });

      syncWindow.on('closed', (event) => {
        syncWindow = null;

        logger.info('Sync: ended');
        tray.syncEnded();
      });
    }).catch(err => {
      logger.error('Sync: pre sync check failed', err);
      tray.syncEnded();
    });
  }

  function end() {
    if(!syncWindow) return;

    if(env.name === 'production' && syncPaused !== true) {
      //do not set timeout when sync has been paused
      syncTimeout = setTimeout(() => {
        start();
      }, ((env.sync && env.sync.interval) || 30) * 1000);
    }

    syncWindow.close();

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
