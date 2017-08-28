const fs = require('graceful-fs');
const path = require('path');
const url = require('url');
const {app, BrowserWindow, ipcMain, shell, dialog} = require('electron');

var autoLaunch = require('auto-launch');

const env = require('../../env.js');
const fsUtility = require('../../lib/fs-utility.js');
const AuthCtrl = require('../../lib/auth/controller.js');

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

var logger = require('../../lib/logger.js');

module.exports = function(env, clientConfig) {
  var startupWindow;
  var selectiveWindow;
  var auth = AuthCtrl(env, clientConfig);
  var configManager = configManagerCtrl(clientConfig);

  function enableAutoLaunch() {
    return new Promise(function(resolve, reject) {
      if(!env.enableAutoLaunch) return resolve();

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
      firstTimeStart(),
      makeSureBalloonDirExists(),
      enableAutoLaunch(),
      authenticate(),
    ]);
  }

  function preSyncCheck() {
    return Promise.all([
      makeSureBalloonDirExists(),
      authenticate()
    ]);
  }

  function firstTimeStart() {
    if(!clientConfig.get('blnUrl') || !clientConfig.get('apiUrl') || !clientConfig.hadConfig()
     || !clientConfig.isActiveInstance()) {
      return firstTimeWizard();
    } else {
      return Promise.resolve();
    }
  }

  function makeSureBalloonDirExists() {
    return new Promise(function(resolve, reject) {
      var balloonDir = clientConfig.get('balloonDir');

      //make sure balloonDir dir exists
      //TODO pixtron - can this be combined with config-manager?
      fs.exists(balloonDir, (exists) => {
        if(exists === false) {
          logger.info('Startup: BalloonDir does not exist. Reseting db, last-cursor and creating BalloonDir');
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
      var balloonDir = clientConfig.get('balloonDir');
      fsUtility.createBalloonDir(balloonDir, (err) => {
        if(err) {
          logger.error('Startup:', {err});
          reject(err);
        } else {
          logger.info('Startup: balloonDir created');
          resolve();
        }
      });
    });
  }

  function authenticate() {
    return new Promise(function(resolve, reject) {
      if(!clientConfig.get('blnUrl') || !clientConfig.get('apiUrl') || !clientConfig.hadConfig() 
       || !clientConfig.isActiveInstance()) {
        return resolve();
      }
      
      auth.login(askCredentials).then(() => {
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }

  function askCredentials() {
    return new Promise(function(resolve, reject) {
      if(!clientConfig.isActiveInstance() || clientConfig.get('disableAutoAuth') !== true && clientConfig.get('onLineState') === true) {
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
          logger.info('requested basic authentication', {username});
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
          logger.info('requested oidc signin', {idpConfig});
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
        resolve();
      }
    });
  }

  function showBalloonDir() {
    if(isAutoLaunch() === false) {
      shell.openItem(clientConfig.get('balloonDir'));
    }
  }

  function welcomeWizard() {
    logger.info('Startup settings: open requested');

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
        logger.info('Startup Settings: change balloon dir');
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
        logger.info('Startup Settings: selective sync');
        openSelectiveSync();
      });
    });
  }

  function firstTimeWizard() {
    logger.info('Startup settings: open requested');

    return new Promise(function(resolve, reject) {
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
        if(!env.blnUrl) {
          logger.info('Startup Settings: change blnUrl', {blnUrl});
          clientConfig.set('onLineState', true);
          clientConfig.setBlnUrl(blnUrl);
        }

        askCredentials().then(() => {
          resolve();
        }).catch((error) => {
          reject(error);
        });
          
        startupWindow.removeListener('closed', windowClosedByUserHandler);
      });
    });
  }

  function openSelectiveSync() {
    logger.info('Startup settings: open selective sync requested');

    return new Promise(function(resolve, reject) {
      if(!selectiveWindow) selectiveWindow = createSelectiveWindow();
      selectiveWindow.show();
      selectiveWindow.focus();

      ipcMain.on('selective-window-loaded',function(){
        selectiveWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
      });

      ipcMain.removeAllListeners('selective-apply');
      ipcMain.on('selective-apply', function(event, ids) {
        logger.info('Startup Settings: apply selective sync', {ids});

        clientConfig.ignoreNode(ids);

        selectiveWindow.close();
      });

      ipcMain.removeAllListeners('selective-cancel');
      ipcMain.on('selective-cancel', function(event) {
        logger.info('Startup Settings: cancel selective sync');
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
      icon: __dirname+'/../../img/taskbar_black.png'
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
      icon: __dirname+'/../../img/taskbar_black.png'
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

      logger.info('Startup settings: closed');
    });

    startupWindow.on('show', (event) => {
      windowStates.opened('startup-settings');

      logger.info('Startup settings: opened');
    });

    if(env.name === 'development') {
      //startupWindow.openDevTools();
    }

    return startupWindow;
  }

  return {
    checkConfig,
    preSyncCheck,
    showBalloonDir,
    askCredentials
  }
}
