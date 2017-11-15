const {ipcMain} = require('electron');
const {autoUpdater} = require('electron-updater');

const logger = require('../logger.js');

var checkRunning = false;

module.exports = function(env, clientConfig, tray, about) {
  autoUpdater.logger = logger;

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update', {category: 'autoupdate'});
    about.update('checking-for-update');
  });

  autoUpdater.on('update-available', (event, info) => {
    logger.info('update available', {
      category: 'autoupdate',
      data: info
    });

    about.update('update-available');
  });

  autoUpdater.on('update-not-available', (event, info) => {
    logger.info('Update not available', {
      category: 'autoupdate',
      data: info
    });

    about.update('update-not-available');
    checkRunning = false;
  });

  autoUpdater.on('error', (event, err) => {
    logger.error('error occured during autoupdate', {
      category: 'autoupdate',
      error: err
    });

    about.update('error');
    checkRunning = false;
  });

  autoUpdater.on('update-downloaded', (event, info) => {
    logger.info('update has been downloaded', {
      category: 'autoupdate',
      data: info
    });

    about.update('update-downloaded');
    tray.toggleState('update', true);
    clientConfig.set('updateAvailable', true);
    checkRunning = false;
  });

  function shouldCheckForUpdates() {
    if(!process.defaultApp && env.name === 'production') {
      if(env.update && env.update.enable !== undefined) {
        return env.update.enable;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  function checkForUpdate() {
    if(!checkRunning && shouldCheckForUpdates()) {
      checkRunning = true;
      autoUpdater.checkForUpdates();
    } else {
      logger.info('skip check for update', {category: 'autoupdate'});
      about.update('update-not-available');
    }
  }

  function quitAndInstall() {
    autoUpdater.quitAndInstall();
  }

  function setUpdateCheckInterval() {
    if(shouldCheckForUpdates() === false) return;

    var intervalHours = 4;
    if(env.update && env.update.checkInterval) {
      intervalHours = env.update.checkInterval;
    }

    var intervalMs = intervalHours * 60 * 60 * 1000;

    logger.info('setting update check interval', {
      category: 'autoupdate',
      interval: intervalMs,
      hours: intervalHours
    });

    setInterval(checkForUpdate, intervalMs);
  }

  setUpdateCheckInterval();

  return {
    checkForUpdate,
    quitAndInstall
  }
}
