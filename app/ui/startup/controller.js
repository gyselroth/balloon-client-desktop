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
  var firstStart = !auth.hasIdentity();

  function enableAutoLaunch() {
    return new Promise(function(resolve, reject) {
      if(env.enableAutoLaunch !== true) return resolve();

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

  function isFirstStart() {
    return firstStart;
  }

  function checkConfig() {
    return Promise.all([
      hasServer(),
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

  function hasServer() {
    if(!clientConfig.get('blnUrl') || !clientConfig.get('apiUrl')) {
      return enterServer();
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
          logger.error('Startup:', err);
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
      if(!clientConfig.get('blnUrl') || !clientConfig.get('apiUrl')) {
        resolve();
      }

      auth.login(askCredentials, function(){
        resolve();
      }).then(() => {
        resolve();
      });
    });
  }

  function askCredentials() {
    return new Promise(function(resolve, reject) {
      if(clientConfig.get('disableAutoAuth') !== true && clientConfig.get('onLineState') === true) {
        if(env.auth.basic === false && env.auth.oidc.length === 0) {
          return Promise.reject(new Error('No authentication configured'));
        } else if(env.auth.basic === true || env.auth.oidc.length > 1) {
          if(!startupWindow) startupWindow = createStartupWindow();

          startupWindow.webContents.executeJavaScript(`switchView('auth')`);
          startupWindow.show();
          startupWindow.focus();

          let windowClosedByUserHandler = function(event) {
              //reject(new Error('Startup Settings window was closed by user'));
          }

          startupWindow.on('closed', windowClosedByUserHandler);
      
          ipcMain.on('startup-auth', function(event) {
            startupWindow.webContents.send('startup-auth', env.auth.basic, env.auth.oidc);
          });

          ipcMain.on('startup-basic-auth', function(event, username, password) {
            logger.info('requested basic auth with username '+username);
            return auth.basicAuth(username, password).then(() => {
              return Promise.resolve();
            });
          });

          ipcMain.on('auth-oidc-signin', function(event, idp) {
            var idpConfig = env.auth.oidc[idp];
            logger.info('requested oidc signin via provider '+idpConfig.provider);
            auth.oidcAuth(idpConfig, function(username){
              if(username !== undefined) {
                welcomeWizard().then(() => {
                  resolve();  
                });
              } else {
                resolve();
              }
            });
          });
        }
      } else {
console.log(5);
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

      ipcMain.on('startup-open-folder', function(event) {
        startupWindow.removeListener('closed', windowClosedByUserHandler);
        startupWindow.close();
        showBalloonDir();
        resolve();
      });
      
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

      ipcMain.on('startup-selective-sync', function(event) {
        logger.info('Startup Settings: selective sync');
        openSelectiveSync();
      });
    });
  }

  function enterServer() {
    logger.info('Startup settings: open requested');

    return new Promise(function(resolve, reject) {
      if(!startupWindow) startupWindow = createStartupWindow();

      startupWindow.webContents.executeJavaScript(`switchView('server')`);
      startupWindow.show();
      startupWindow.focus();

      let windowClosedByUserHandler = function(event) {
        //reject(new Error('Startup Settings window was closed by user'));
      }

      startupWindow.on('closed', windowClosedByUserHandler);

      ipcMain.on('startup-server-continue', function(event, blnUrl) {
        logger.info('Startup Settings: setting blnUrl to: ' + blnUrl);

        clientConfig.set('onLineState', true);
        clientConfig.setBlnUrl(blnUrl);
        askCredentials().then(() => {
          resolve();
        });
        //startupWindow.removeListener('closed', windowClosedByUserHandler);
        //startupWindow.close();

        //resolve();
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
        selectiveWindow.webContents.send('selective-ignore-path', clientConfig.get('ignorePath'));
      });

      ipcMain.on('selective-apply', function(event, path) {
        logger.info('Startup Settings: apply selective sync');
        clientConfig.set('ignorePath', path);
        selectiveWindow.close();
        selectiveWindow = undefined;
      });
      
      ipcMain.on('selective-cancel', function(event) {
        logger.info('Startup Settings: cancel selective sync');
        selectiveWindow.close();
        selectiveWindow = undefined;
      });
    });
  }

  function createSelectiveWindow() {
    if(selectiveWindow) return selectiveWindow;

    selectiveWindow = new BrowserWindow({
      width: 380,
      height: 450,
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

    selectiveWindow.setMenu(null);

    if(env.name === 'development') {
      selectiveWindow.openDevTools();
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
      startupWindow.openDevTools();
    }

    return startupWindow;
  }

  return {
    checkConfig,
    preSyncCheck,
    showBalloonDir,
    isFirstStart,
  }
}
