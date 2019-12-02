const fs = require('fs');

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

      //if com.apple.quarantine is set appPath will be a temporary path see #177
      if(appPath.startsWith('/private/')) {
        //try to set it to the default path
        appPath = '/Applications/Balloon.app';

        if(!fs.existsSync(appPath)) {
          //if app does not exist at default location avoid creating a login item
          logger.error('appPath starts with /private/. Will not try to enable autolaunch for a temporary appPath', {category: 'autolaunch'});
          return;
        }
      }
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
      logger.debug('verify that autolaunch has correct state', {category: 'autolaunch'});

      if(globalConfig.has('enableAutoLaunch') === false || globalConfig.get('enableAutoLaunch') === false) {
        this.disable().then(resolve, reject);
      } else {
        this.enable().then(resolve, reject);
      }
    });
  }

  disable() {
    if(!this.autoLaunch) return Promise.resolve();

    logger.debug('trying to disable auto launch', {category: 'autolaunch'});

    return new Promise((resolve, reject) => {
      this.autoLaunch.isEnabled().then(isEnabled => {
        if(isEnabled === false) {
          logger.debug('Autolaunch not currently enabled. Skip disable', {category: 'autolaunch'});
          return resolve();
        } else {
          this.autoLaunch.disable().then(function() {
            logger.debug('autolaunch disabled', {category: 'autolaunch'});
            return resolve();
          }).catch(function(err) {
            logger.error('could not disabled autolaunch', {category: 'autolaunch', err});
            return reject(err);
          });
        }
      }).catch(err => {
        if(err.message && err.message.match(/(-1743)/)) {
          logger.error('Autolaunch can\'t be controlled by balloon as it is not allowed to send Apple-Events to System Events.', {category: 'autolaunch'});
          return resolve();
        }

        logger.error('could not query autolaunch state', {category: 'autolaunch', err});
        return reject(err);
      });
    });
  }

  enable() {
    if(!this.autoLaunch) return Promise.resolve();

    logger.debug('trying to enable autolaunch', {category: 'autolaunch'});

    return new Promise((resolve, reject) => {
      this.autoLaunch.isEnabled().then(isEnabled => {
        if(isEnabled === true) {
          logger.debug('autolaunch already enabled. Skip enable', {category: 'autolaunch'});
          return resolve();
        } else {
          this.autoLaunch.enable().then(function() {
            logger.debug('autolaunch enabled', {category: 'autolaunch'});
            return resolve();
          }).catch(function(err) {
            logger.error('could not enable autolaunch', {category: 'autolaunch', err});
            return reject(err);
          });
        }
      }).catch(err => {
        if(err.message && err.message.match(/(-1743)/)) {
          logger.error('Autolaunch can\'t be controlled by balloon as it is not allowed to send Apple-Events to System Events.', {category: 'autolaunch'});
          return resolve();
        }

        logger.error('could not query autolaunch state', {category: 'autolaunch', err});
        return reject(err);
      });
    });
  }
}


module.exports = new BalloonAutoLaunch();
