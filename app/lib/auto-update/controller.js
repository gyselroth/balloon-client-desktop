const {ipcMain} = require('electron');
const {autoUpdater} = require('electron-updater');

const logger = require('../logger.js');

var checkRunning = false;

module.exports = function(env, clientConfig, tray, about) {
  autoUpdater.logger = logger;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Autoupdater: Checking for update.');
    about.update('checking-for-update');
  });

  autoUpdater.on('update-available', (event, info) => {
    logger.info('Autoupdater: Update available.', {info});
    about.update('update-available');
  });

  autoUpdater.on('update-not-available', (event, info) => {
    logger.info('Autoupdater: Update not available.', {info});
    about.update('update-not-available');
    checkRunning = false;
  });

  autoUpdater.on('error', (event, err) => {
    logger.error('Autoupdater: error', {err});
    about.update('error');
    checkRunning = false;
  });

  autoUpdater.on('update-downloaded', (event, info) => {
    logger.info('Autoupdater: Update downloaded', {info});
    about.update('update-downloaded');
    tray.toggleState('update', true);
    clientConfig.set('updateAvailable', true);
    checkRunning = false;
  });

  function shouldCheckForUpdates() {
    return !process.defaultApp && env.name === 'production';
  }

  function checkForUpdate() {
    if(!checkRunning && shouldCheckForUpdates()) {
      checkRunning = true;
      autoUpdater.checkForUpdates();
    } else {
      about.update('update-not-available');
    }
  }

  function quitAndInstall() {
    autoUpdater.quitAndInstall();
  }

  function setUpdateCheckInterval() {
    if(shouldCheckForUpdates() === false) return;

    var intervalD = env.updateCheckInterval || 7;
    var intervalMs = intervalD * 24 * 60 * 60 * 1000;

    logger.info('Autoupdate: setting update check interval', {intervalMs, intervalD});
    setInterval(checkForUpdate, intervalMs);
  }

  setUpdateCheckInterval();

  return {
    checkForUpdate,
    quitAndInstall
  }
}
