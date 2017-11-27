const fs = require('graceful-fs');
const path = require('path');
const url = require('url');
const {app, BrowserWindow, ipcMain, shell, dialog} = require('electron');

var autoLaunch = require('auto-launch');

const env = require('../../env.js');
const fsUtility = require('../../lib/fs-utility.js');
const AuthCtrl = require('../../lib/auth/controller.js');
const NodeSettingsCtrl = require('../node-settings/controller.js');

const configManagerCtrl = require('../../lib/config-manager/controller.js');

var appPath;

if(process.platform === 'darwin') {
  //This is a workaround for: https://github.com/Teamwork/node-auto-launch/issues/28
  //Might be removed as soon as the issue has been resolved
  appPath = app.getPath('exe').split('.app/Content')[0] + '.app';
}

var balloonAutoLauncher = new autoLaunch({
    name: 'Balloon',
    path: appPath,
    isHidden: true
});

const logger = require('../../lib/logger.js');

module.exports = function(env, clientConfig) {
  var startupWindow;
  var selectiveWindow;
  var auth = AuthCtrl(env, clientConfig);
  var configManager = configManagerCtrl(clientConfig);

  function enableAutoLaunch() {
    return new Promise(function(resolve, reject) {
      if(env.enableAutoLaunch === false) {
        logger.debug('autolaunch is disabled, skip enabling autolaunch', {
          category: 'startup'
        });
        return resolve();
      }

      logger.debug('verify that autolaunch is enabled', {category: 'startup'});
      balloonAutoLauncher.isEnabled().then(function(isEnabled) {
        if(!isEnabled) {
          balloonAutoLauncher.enable().then(function(isEnabled) {
            resolve();
          }).catch(function(err) {
            reject(err);
          });
        } else {
          resolve();
        }
      }).catch(function(err){
        reject(err);
      });
    });
  }

  function isAutoLaunch() {
    return process.argv.find(argument => {return argument === '--hidden'}) !== undefined;
  }

  function checkConfig() {
    return Promise.all([
      makeSureBalloonDirExists(),
      enableAutoLaunch(),
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
    } else if(clientConfig.get('onLineState') === false) {
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

      if(clientConfig.get('onLineState') === true) {
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
              welcomeWizard().then(() => {
                resolve();
              });
            } else {
              startupWindow.close();
              resolve();
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
              welcomeWizard().then(() => {
                resolve();
              });
            } else {
              startupWindow.close();
              resolve();
            }
          }).catch((error) => {
            startupWindow.webContents.send('startup-auth-error',  'oidc');
          });
        });
      } else {
        logger.error('can not ask for authentication credentials, there is an active instance ongoing', {
            category: 'startup'
        });
        resolve();
      }
    });
  }

  function showBalloonDir() {
    if(isAutoLaunch() === false) {
      shell.openItem(clientConfig.get('balloonDir'));
    }
  }

  function showNodeSettingsWindow(nodePath) {
      if (nodePath) {
        logger.info('open node-settings window', {
          category: 'startup',
          nodePath: nodePath
        });

        if (app.isReady()) {
            NodeSettingsCtrl(env).open(nodePath);
        } else {
          app.on('ready', function () {
              NodeSettingsCtrl(env).open(nodePath);
          });
        }
      }
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
        showBalloonDir();
        resolve();
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

      ipcMain.removeAllListeners('startup-selective-sync');
      ipcMain.on('startup-selective-sync', function(event) {
        logger.info('open selective sync window', {category: 'startup'});
        openSelectiveSync();
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
        clientConfig.set('onLineState', true);

        if(!env.blnUrl) {
          logger.info('change url to server', {
            category: 'startup',
            url: blnUrl
          });

          clientConfig.setBlnUrl(blnUrl);
        }

        askCredentials().then(() => {
          resolve();
        }).catch((error) => {
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

  function openSelectiveSync() {
    logger.info('Startup settings: open selective sync requested', {category: 'startup'});

    return new Promise(function(resolve, reject) {
      if(!selectiveWindow) selectiveWindow = createSelectiveWindow();
      selectiveWindow.show();
      selectiveWindow.focus();

      ipcMain.on('selective-window-loaded',function(){
        selectiveWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
      });

      ipcMain.removeAllListeners('selective-apply');
      ipcMain.on('selective-apply', function(event, ids) {
        logger.info('apply selective sync settings', {
          category: 'startup',
          data: ids
        });

        clientConfig.ignoreNode(ids);

        selectiveWindow.close();
      });

      ipcMain.removeAllListeners('selective-cancel');
      ipcMain.on('selective-cancel', function(event) {
        logger.info('cancel selective sync settings', {category: 'startup'});
        selectiveWindow.close();
      });
    });
  }

  function createSelectiveWindow() {
    if(selectiveWindow) return selectiveWindow;

    selectiveWindow = new BrowserWindow({
      width: 380,
      height: 490,
      show: false,
      frame: true,
      fullscreenable: false,
      resizable: false,
      transparent: false,
      skipTaskbar: false,
      icon: __dirname+'/../../img/logo-512x512.png'
    });

    selectiveWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'selective.html'),
        protocol: 'file:',
        slashes: true
    }));

    let windowClosedByUserHandler = function(event) {
      selectiveWindow = undefined;
    }
    selectiveWindow.on('closed', windowClosedByUserHandler);

    selectiveWindow.setMenu(null);

    if(env.name === 'development') {
      //selectiveWindow.openDevTools();
    }

    return selectiveWindow;
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
      startupWindow.openDevTools();
    }

    return startupWindow;
  }

  return {
    checkConfig,
    preSyncCheck,
    showBalloonDir,
    showNodeSettingsWindow
  }
}
