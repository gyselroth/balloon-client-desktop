const electron = require('electron');
const app = electron.app || electron.remote.app;

const AutoLaunch = require('auto-launch');

const globalConfig = require('./global-config.js');
const logger = require('./logger.js');

class BalloonAutoLaunch {
  constructor() {
    let appPath;

    if(process.platform === 'darwin') {
      //This is a workaround for: https://github.com/Teamwork/node-auto-launch/issues/28
      //Might be removed as soon as the issue has been resolved
      appPath = app.getPath('exe').split('.app/Content')[0] + '.app';
    }

    this.autoLaunch = new AutoLaunch({
        name: 'Balloon',
        path: appPath,
        isHidden: true
    });
  }

  getState() {
    return globalConfig.get('enableAutoLaunch');
  }

  setState(enabled) {
    globalConfig.set('enableAutoLaunch', enabled);
    return this.ensureCorrectState();
  }

  ensureCorrectState() {
    return new Promise((resolve, reject) => {
      logger.debug('Verify that autolaunch has correct state', {category: 'autolaunch'});

      if(globalConfig.has('enableAutoLaunch') === false || globalConfig.get('enableAutoLaunch') === false) {
        this.disable().then(resolve, reject);
      } else {
        this.enable().then(resolve, reject);
      }
    });
  }

  disable() {
    logger.debug('Trying to disable auto launch', {category: 'autolaunch'});

    return new Promise((resolve, reject) => {
      this.autoLaunch.isEnabled().then(isEnabled => {
        if(isEnabled === false) {
          logger.debug('Autolaunch not currently enabled. Skip disable', {category: 'autolaunch'});
          return resolve();
        } else {
          this.autoLaunch.disable().then(function() {
            logger.debug('Autolaunch disabled', {category: 'autolaunch'});
            return resolve();
          }).catch(function(err) {
            logger.error('Could not disabled autolaunch', {category: 'autolaunch', err});
            return reject(err);
          });
        }
      }).catch(err => {
        logger.error('Could not query autolaunch state', {category: 'autolaunch', err});
        return reject(err);
      });
    });
  }

  enable() {
    logger.debug('Trying to enable autolaunch', {category: 'autolaunch'});

    return new Promise((resolve, reject) => {
      this.autoLaunch.isEnabled().then(isEnabled => {
        if(isEnabled === true) {
          logger.debug('Autolaunch already enabled. Skip enable', {category: 'autolaunch'});
          return resolve();
        } else {
          this.autoLaunch.enable().then(function() {
            logger.debug('Autolaunch enabled', {category: 'autolaunch'});
            return resolve();
          }).catch(function(err) {
            logger.error('Could not enable autolaunch', {category: 'autolaunch', err});
            return reject(err);
          });
        }
      }).catch(err => {
        logger.error('Could not query autolaunch state', {category: 'autolaunch', err});
        return reject(err);
      });
    });
  }
}


module.exports = new BalloonAutoLaunch();
