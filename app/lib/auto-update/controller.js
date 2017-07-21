const {ipcMain} = require('electron');
const {autoUpdater} = require('electron-updater');

const logger = require('../logger.js');

var checkRunning = false;

module.exports = function(env, clientConfig, tray) {
  autoUpdater.logger = logger;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Autoupdater: Checking for update.');
  });

  autoUpdater.on('update-available', (event, info) => {
    logger.info('Autoupdater: Update available.', {info});
  });

  autoUpdater.on('update-not-available', (event, info) => {
    logger.info('Autoupdater: Update not available.', {info});
    checkRunning = false;
  });

  autoUpdater.on('error', (event, err) => {
    logger.error('Autoupdater: error', {err});
    checkRunning = false;
  });

  autoUpdater.on('update-downloaded', (event, info) => {
    logger.info('Autoupdater: Update downloaded', {info});
    tray.toggleState('update', true);
    clientConfig.set('updateAvailable', true);
    checkRunning = false;
  });

  function checkForUpdate() {
    if(!process.defaultApp && env.name === 'production' && !checkRunning) {
      checkRunning = true;
      autoUpdater.checkForUpdates();
    }
  }

  function quitAndInstall() {
    autoUpdater.quitAndInstall();
  }

  return {
    checkForUpdate,
    quitAndInstall
  }
}
