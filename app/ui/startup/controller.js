const fs = require('graceful-fs');
const path = require('path');
const url = require('url');
const {BrowserWindow, ipcMain, shell, dialog} = require('electron');

const env = require('../../env.js');
const appState = require('../../lib/state.js');
const fsUtility = require('../../lib/fs-utility.js');
const AuthCtrl = require('../../lib/auth/controller.js');
const configManagerCtrl = require('../../lib/config-manager/controller.js');
const autoLaunch = require('../../lib/auto-launch.js');
const {BalloonBurlHandler} = require('../../lib/burl.js');

const logger = require('../../lib/logger.js');

module.exports = function(env, clientConfig) {
  var startupWindow;
  var auth = AuthCtrl(env, clientConfig);
  var configManager = configManagerCtrl(clientConfig);
  var burlHandler = new BalloonBurlHandler(clientConfig);

  function ensureCorrectAutoLaunchState() {
    return autoLaunch.ensureCorrectState();
  }

  function isAutoLaunch() {
    return process.argv.find(argument => {return argument === '--hidden'}) !== undefined;
  }

  function extractBurlArgument() {
    return process.argv.find(argument => {return burlHandler.isBalloonBurlPath(argument)});
  }

  function checkConfig() {
    return Promise.all([
      makeSureBalloonDirExists(),
      ensureCorrectAutoLaunchState(),
      authenticate(),
    ]);
  }

  function preSyncCheck() {
    return makeSureBalloonDirExists();
  }

  function makeSureBalloonDirExists() {
    return new Promise(function(resolve, reject) {
      var balloonDir = clientConfig.get('balloonDir');
      logger.debug('verify that balloonDir exists', {category: 'startup'});

      //make sure balloonDir dir exists
      //TODO pixtron - can this be combined with config-manager?
      fs.exists(balloonDir, (exists) => {
        if(exists === false) {
          logger.info('BalloonDir does not exist. Reseting db, last-cursor and creating BalloonDir', {
            category: 'startup'
          });

          //when balloonDir does not exist, cursor and db have to be reset too
          return Promise.all([
            configManager.resetCursorAndDb(),
            createBalloonDir()
          ]).then(resolve, reject);
        } else {
          resolve();
        }
      });
    });
  }

  function createBalloonDir() {
    return new Promise(function(resolve, reject) {
      fsUtility.createBalloonDir(clientConfig.get('balloonDir'), clientConfig.get('homeDir'), (err) => {
        if(err) {
          logger.error('failed create ballon dir', {
            category: 'startup',
            error: err
          });

          reject(err);
        } else {
          logger.info('balloonDir created', {
            category: 'startup'
          });

          resolve();
        }
      });
    });
  }

  function authenticate() {
    if(!clientConfig.get('blnUrl')
        ||
        !clientConfig.get('apiUrl')
        ||
        !clientConfig.hadConfig()
        ||
        !clientConfig.isActiveInstance()
    ) {
      logger.debug('skip startup authentication, first time wizard needs to be executed first', {
          category: 'startup'
      });
      return firstTimeWizard();
    } else if(appState.get('onLineState') === false) {
      // authentication is not possible, as client is offline
      return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
      logger.debug('verify authentication', {category: 'startup'});
      auth.login(askCredentials).then(() => {
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }

  function askCredentials() {
    return new Promise(function(resolve, reject) {
      logger.debug('ask user for authentication credentials', {category: 'startup'});

      if(appState.get('onLineState') === true) {
        logger.debug('waiting for user action', {category: 'startup'});
        if(!startupWindow) startupWindow = createStartupWindow();

        startupWindow.webContents.executeJavaScript(`switchView('auth')`);
        startupWindow.show();
        startupWindow.focus();

        let windowClosedByUserHandler = function(event) {
          if(!clientConfig.hadConfig()) {
            reject(new Error('auth window closed by user'));
          }
        }

        startupWindow.on('closed', windowClosedByUserHandler);

        ipcMain.removeAllListeners('startup-basic-auth');
        ipcMain.on('startup-basic-auth', function(event, username, password) {
          logger.info('requested basic authentication', {
            category: 'startup',
            username: username
          });

          startupWindow.removeListener('closed', windowClosedByUserHandler);
          auth.basicAuth(username, password).then(() => {
            if(!clientConfig.hadConfig()) {
              resolve({welcomeWizardPromise: welcomeWizard()});
            } else {
              startupWindow.close();
              resolve({welcomeWizardPromise: Promise.resolve()});
            }
          }).catch((error) => {
            startupWindow.webContents.send('startup-auth-error',  'basic');
          });
        });

        ipcMain.removeAllListeners('auth-oidc-signin');
        ipcMain.on('auth-oidc-signin', function(event, idp) {
          var idpConfig = env.auth.oidc[idp];
          logger.info('requested oidc signin', {
            category: 'startup',
            idp: idpConfig
          });

          startupWindow.removeListener('closed', windowClosedByUserHandler);
          auth.oidcAuth(idpConfig).then(() => {
            if(!clientConfig.hadConfig()) {
              resolve({welcomeWizardPromise: welcomeWizard()});
            } else {
              startupWindow.close();
              resolve({welcomeWizardPromise: welcomeWizard()});
            }
          }).catch((error) => {
            startupWindow.webContents.send('startup-auth-error',  'oidc');
          });
        });
      } else {
        logger.error('can not ask for authentication credentials, there is an active instance ongoing', {
            category: 'startup'
        });
        resolve({welcomeWizardPromise: welcomeWizard()});
      }
    });
  }

  function showBalloonDir() {
    //if app is Launched through autolaunch do not open BalloonDir
    if(isAutoLaunch()) return Promise.resolve();
    let burlArgument = extractBurlArgument();
    if (burlArgument) {
      return burlHandler.handleBurl(burlArgument);
    };

    return new Promise(function(resolve, reject) {
      makeSureBalloonDirExists().then(function() {
        shell.openItem(clientConfig.get('balloonDir'));
        resolve();
      }).catch((error) => {
        logger.error('failed to open balloonDir', {
          category: 'startup',
          error: error
        });

        reject(error);
      });
    });
  }

  function welcomeWizard() {
    logger.info('Startup settings: open requested', {category: 'startup'});

    return new Promise(function(resolve, reject) {
      if(!startupWindow) startupWindow = createStartupWindow();

      startupWindow.webContents.executeJavaScript(`switchView('welcome')`);
      startupWindow.show();
      startupWindow.focus();

      let windowClosedByUserHandler = function(event) {
        resolve();
      }

      startupWindow.on('closed', windowClosedByUserHandler);

      ipcMain.removeAllListeners('startup-open-folder');
      ipcMain.on('startup-open-folder', function(event) {
        startupWindow.removeListener('closed', windowClosedByUserHandler);
        startupWindow.close();
        showBalloonDir().then(resolve, reject);
      });

      ipcMain.removeAllListeners('startup-change-dir');
      ipcMain.on('startup-change-dir', function(event) {
        logger.info('change balloon data directory', {category: 'startup'});

        dialog.showOpenDialog({
          title: 'Select balloon directory',
          defaultPath: clientConfig.balloonDir,
          properties: ['openDirectory']
        }, (folder) => {
          if(folder) {
            var p = folder[0]+path.sep+'Balloon';
            startupWindow.webContents.send('startup-change-dir', p);
            clientConfig.set('balloonDir', p);
          }
        });
      });
    });
  }

  function firstTimeWizard() {
    logger.info('start first time wizard', {category: 'startup'});

    return new Promise(function(resolve, reject) {

      if(clientConfig.isActiveInstance()) {
        logger.info('first time wizard unlinked active instance', {category: 'startup'});
        auth.logout();
      }

      if(!startupWindow) startupWindow = createStartupWindow();

      startupWindow.webContents.executeJavaScript(`switchView('server')`);
      startupWindow.show();
      startupWindow.focus();

      let windowClosedByUserHandler = function(event) {
        reject(new Error('first start window closed by user'));
      }

      startupWindow.on('closed', windowClosedByUserHandler);

      ipcMain.removeAllListeners('startup-server-continue');
      ipcMain.on('startup-server-continue', function(event, blnUrl) {
        //TODO pixtron - this should not be set here. This should only be changed by the event listeners.
        appState.set('onLineState', true);

        if(!env.blnUrl) {
          logger.info('change url to server', {
            category: 'startup',
            url: blnUrl
          });

          clientConfig.setBlnUrl(blnUrl);
        }

        askCredentials().then(resolve).catch((error) => {
          logger.error('failed ask for credentials', {
            category: 'startup',
            error: error
          });

          reject(error);
        });

        startupWindow.removeListener('closed', windowClosedByUserHandler);
      });
    });
  }

  function createStartupWindow() {
    if(startupWindow) return startupWindow;

    startupWindow = new BrowserWindow({
      width: 450,
      height: 550,
      show: false,
      frame: true,
      fullscreenable: false,
      resizable: false,
      transparent: false,
      skipTaskbar: false,
      icon: __dirname+'/../../img/logo-512x512.png'
    });


    startupWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    startupWindow.setMenu(null);

    startupWindow.on('closed', (event) => {
      startupWindow = null;

      windowStates.closed('startup-settings');

      logger.debug('startup window closed', {category: 'startup'});
    });

    startupWindow.on('show', (event) => {
      windowStates.opened('startup-settings');

      logger.debug('startup window opened', {category: 'startup'});
    });

    if(env.name === 'development') {
      //startupWindow.openDevTools();
    }

    return startupWindow;
  }

  return {
    checkConfig,
    preSyncCheck,
    showBalloonDir
  }
}
