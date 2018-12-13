const electron = require('electron');
const {app, ipcMain, dialog} = require('electron');

const env = require('./env.js');
const clientConfig = require('./lib/config.js');
const appState = require('./lib/state.js');
const migrate = require('./lib/migrate.js');
const TrayCtrl = require('./ui/tray/controller.js');
const SelectiveCtrl = require('./ui/selective/controller.js');
const SyncCtrl = require('./lib/sync/controller.js');
const StartupCtrl = require('./ui/startup/controller.js');
const AuthCtrl = require('./lib/auth/controller.js');
const AutoUpdateCtrl = require('./lib/auto-update/controller.js');
const FeedbackCtrl = require('./ui/feedback/controller.js');
const setMenu = require('./lib/menu.js');
const BalloonDirSelectorCtrl = require('./ui/balloon-dir-selector/controller.js');
const {BalloonBurlHandler} = require('./lib/burl.js');
const ipc = require ('./lib/ipc.js');
const i18n = require ('./lib/i18n.js');

const logger = require('./lib/logger.js');
const loggerFactory = require('./lib/logger-factory.js');
const configManager = require('./lib/config-manager/controller.js')(clientConfig);
const globalConfig = require('./lib/global-config.js');

var tray, selective, sync, feedback, autoUpdates;

var standardLogger = new loggerFactory(clientConfig.getAll());
var startup = StartupCtrl(env, clientConfig);
var auth = AuthCtrl(env, clientConfig);
var selective = SelectiveCtrl(env, clientConfig);
var ballonDirSelector = BalloonDirSelectorCtrl(env, clientConfig);
var burlHandler = new BalloonBurlHandler(clientConfig);

if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
}

logger.setLogger(standardLogger);

function extractBurlArgument() {
  return process.argv.find(argument => {return burlHandler.isBalloonBurlPath(argument)});
}

process.on('uncaughtException', function(exception) {
  logger.error('uncaught exception', {
    category: 'main',
    error: exception
  });
});

function openBurl(burlPath) {
  if (burlHandler.isBalloonBurlPath(burlPath)) {
    burlHandler.extractBurl(burlPath).then((burl) => {
      dialog.showMessageBox(null, {
        type: 'question',
        buttons: [i18n.__('button.continue'), i18n.__('button.cancel')],
        title: 'Balloon URL',
        message: i18n.__('burl.prompt'),
        detail: burl,
      }, (buttonIndex) => {
        if (0 === buttonIndex) {
          burlHandler.handleBurl(burl);
        }
      });
    }).catch((error) => {
      dialog.showMessageBox(null, {
        type: 'error',
        buttons: [i18n.__('button.close')],
        title: 'Balloon URL',
        message: i18n.__('burl.' + error.error),
        detail: error.burl,
      });
    });
  }
}

function startApp() {
  logger.info('bootstrap app', {category: 'main'});

  auth.retrieveLoginSecret().then(() => {
    logger.info('login secret recieved', {category: 'main'});

    ipcMain.once('tray-online-state-changed', function(event, state) {
      if(clientConfig.hadConfig()) {
        tray.create();
        autoUpdate.checkForUpdate();
      }

      logger.info('initial online state', {
        category: 'main',
        state: state
      });

      appState.set('onLineState', state);
      startup.checkConfig().then((result) => {
        logger.info('startup checkconfig successfull', {
          category: 'main',
        });

        if(!tray.isRunning()) {
          tray.create();
        }

        sync = SyncCtrl(env, tray);

        const welcomeWizard = result[2] === undefined || !result[2].welcomeWizardPromise ? Promise.resolve() : result[2].welcomeWizardPromise;

        welcomeWizard.then(() => {
          sync.setMayStart(true);

          startSync(true);

          electron.powerMonitor.on('suspend', () => {
            logger.info('the system is going to sleep', {
              category: 'main',
            });

            //abort a possibly active sync if not already paused
            if(sync && sync.isPaused() === false) {
              sync.pause(true);
            } else if(sync) {
              //if sync is paused kill a possible active watcher
              sync.killWatcher();
            }
          });

          electron.powerMonitor.on('resume', () => {
            logger.info('the system is resuming', {
              category: 'main',
            });

            startSync(true);
          });
        });
      }).catch((error) => {
        logger.error('startup checkconfig', {
            category: 'main',
            error: error
        });

        switch(error.code) {
          case 'E_BLN_CONFIG_CREDENTIALS':
            unlinkAccount();
          break;
          default:
            app.quit();
        }
      });
    });

    tray = TrayCtrl(env, clientConfig);
    autoUpdate = AutoUpdateCtrl(env, clientConfig, tray);
    ipc.listen((data) => {
      switch(data.type) {
        case 'open-burl':
          openBurl(data.payload);
          break;
        case 'open-balloon':
        default:
          if (tray.isWindowVisible() || process.platform !== 'linux') {
            startup.showBalloonDir();
          } else {
            tray.show();
          }
      }
    })
  });
}

function unlinkAccount() {
  (function() {
    if(!sync) return Promise.resolve();

    return sync.pause(true);
  }()).then(function() {
    return auth.logout();
  }).then(() => {
    logger.info('logout successfull', {
      category: 'main',
    });

    tray.emit('unlink-account-result', true);
    tray.toggleState('loggedout', true);
  }).catch((error) => {
    logger.error('logout not successfull', {
      category: 'main',
      error: error
    });

    tray.emit('unlink-account-result', false);
  });
}

var shouldQuit = app.makeSingleInstance((cmd, cwd) => {});

if(shouldQuit === true && process.platform !== 'darwin') {
  let burlArgument = extractBurlArgument();
  if (burlArgument) {
    ipc.send({type: 'open-burl', payload: burlArgument}).then(() => {
      app.quit();
    });
  } else {
    ipc.send({type: 'open-balloon'}).then(() => {
      app.quit();
    });
  }
} else {
  app.on('open-file', function(event, path) {
    if (process.platform === 'darwin') {
      openBurl(path);
    }
  });

  app.on('ready', function () {
    appState.set('updateAvailable', false);

    feedback = FeedbackCtrl(env, clientConfig);
    feedback.toggleAutoReport(globalConfig.get('autoReport'));

    logger.info('app ready to operate', {
        category: 'main',
    });

    setMenu();

    migrate().then(result => {
      startApp();
    }).catch(err => {
      logger.error('error during migration, quitting app', {
        category: 'main',
        error: err
      });

      app.quit();
    })
  });
}
/** Main App **/
ipcMain.on('quit', function() {
  app.quit();
});

/** Tray **/
ipcMain.on('tray-toggle', function() {
  tray.toggle();
});

ipcMain.on('tray-hide', function() {
  tray.hide();
});

ipcMain.on('tray-show', function() {
  tray.show();
});

ipcMain.on('tray-online-state-changed', function(event, state) {
  logger.info('online state changed', {
    category: 'main',
    state: state,
    syncPaused: (sync && sync.isPaused())
  });

  appState.set('onLineState', state);
  if(state === false) {
    //abort a possibly active sync if not already paused
    if(sync && sync.isPaused() === false) sync.pause(true);
    tray.toggleState('offline', true);
  } else {
    if(sync && sync.isPaused() === false) startSync(true);
    tray.toggleState('offline', false);
  }
});

/** Settings **/
ipcMain.on('settings-autoReport-changed', function(event, state) {
  feedback.toggleAutoReport(state);
});


/** Auto update **/
ipcMain.on('install-update', function() {
  logger.info('install-update triggered', {
    category: 'main',
  });

  dialog.showMessageBox(null, {
    type: 'question',
    buttons: [i18n.__('button.continue'), i18n.__('button.cancel')],
    title: 'Update',
    message: i18n.__('update.install'),
  }, (buttonIndex) => {
    if (0 === buttonIndex) {
      autoUpdate.quitAndInstall();
    }
  });
});

ipcMain.on('check-for-update', function() {
  logger.info('check-for-update triggered', {
      category: 'main',
  });

  autoUpdate.checkForUpdate();
});

/** Sync **/
ipcMain.on('sync-toggle-pause', () => {
  if(!sync) {
    return tray.syncPaused();
  }

  tray.toggleState('pause', !sync.isPaused());
  sync.togglePause();
});

ipcMain.on('selective-open', function(event) {
  selective.open();
});

ipcMain.on('selective-close', function(event) {
  selective.close();
});

ipcMain.on('selective-apply', function(event, difference) {
  logger.info('Applying selective sync changes', {category: 'main', difference});

  if(sync) sync.updateSelectiveSync(difference, err => {
    selective.close();
  });
});

ipcMain.on('balloonDirSelector-open', function(event) {
  (function() {
    if(!sync) return Promise.resolve();

    return sync.pause(true);
  }()).then(function() {
    return ballonDirSelector.open();
  }).then((result) => {
    event.sender.send('balloonDirSelector-result', result);
    startSync((result && result.newPath));
  }).catch((err) => {
    if(err) logger.error('Change balloon dir failed', {category: 'main', err});
    startSync(false);
  });
});

ipcMain.on('unlink-account', (event) => {
  logger.info('logout requested', {category: 'main'});
  unlinkAccount();
});

ipcMain.on('link-account', (event, id) => {
  logger.info('login requested', {category: 'main'});

  startup.checkConfig().then(() => {
    logger.info('login successfull', {
      category: 'main',
      data: clientConfig.getMulti(['username', 'loggedin'])
    });

    clientConfig.updateTraySecret();

    tray.toggleState('loggedout', false);
    startSync(true);
    event.sender.send('link-account-result', true);
  }).catch((err) => {
    if(err.code !== 'E_BLN_OAUTH_WINDOW_OPEN') {
      logger.error('login not successfull', {
        category: 'main',
        error: err
      });
    } else {
      logger.info('login aborted as there is already a login window open', {
        category: 'main',
      });
    }

    event.sender.send('link-account-result', false);
  });
});

ipcMain.on('selective-error', (event, error, url, line, message) => {
  switch(error.code) {
    case 'E_BLN_API_REQUEST_UNAUTHORIZED':
      selective.close();
      if(clientConfig.get('authMethod') === 'basic') {
        logger.info('got 401 from selective, unlink account', {category: 'main'});
        unlinkAccount();
      } else {
        logger.debug('got 401 from selective, refresh accessToken', {category: 'main'});
        auth.refreshAccessToken().then(() => {
          selective.open();
        }).catch(() => {
          logger.error('could not refresh accessToken after selective-error, unlink instance', {category: 'main'});
          unlinkAccount();
        });
      }
    break;
    default:
      logger.error('Uncaught selective error.', {
        category: 'main',
        error,
        url,
        line,
        errorMsg: message
      });

      selective.close();
  }
});

ipcMain.on('sync-error', (event, error, url, line, message) => {
  switch(error.code) {
    case 'E_BLN_API_REQUEST_UNAUTHORIZED':
      endSync();

      if(clientConfig.get('authMethod') === 'basic') {
        logger.info('got 401, end sync and unlink account', {category: 'main'});
        unlinkAccount();
      } else {
        logger.debug('got 401, refresh accessToken', {category: 'main'});
        auth.refreshAccessToken().then(() => {
          startSync(true);
        }).catch(err => {
          logger.error('could not refresh accessToken, unlink instance', {category: 'main', err});
          unlinkAccount();
        });
      }
    break;
    case 'E_BLN_CONFIG_CREDENTIALS':
      logger.error('credentials not set', {
        category: 'main',
        code: error.code
      });

      endSync();
      unlinkAccount();
    break;
    case 'E_BLN_CONFIG_BALLOONDIR':
    case 'E_BLN_CONFIG_CONFIGDIR':
    case 'E_BLN_CONFIG_CONFIGDIR_NOTEXISTS':
    case 'E_BLN_CONFIG_APIURL':
      //this should only happen, when user deletes the configuation, while the application is running
      logger.info('reinitializing config, config sync error occured', {
        category: 'main',
        code: error.code
      });

      clientConfig.initialize();
      endSync();
      startSync(true);
    break;
    case 'E_BLN_CONFIG_CONFIGDIR_ACCES':
      logger.error('config dir not accesible.', {
        category: 'main',
        error
      });
      endSync();
    break;
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case 'ENETUNREACH':
    case 'EHOSTUNREACH':
    case 'ECONNREFUSED':
    case 'EHOSTDOWN':
    case 'ESOCKETTIMEDOUT':
    case 'ECONNRESET':
      logger.error('sync terminated with networkproblems.', {
        category: 'main',
        code: error.code
      });
      endSync();
      tray.emit('network-offline');
    break;
    case 'BLN_API_DELTA_RESET':
      logger.info('Remote delta triggered reset. Resetting cursor and db', {
        category: 'main',
        code: error.code
      });

      endSync();
      configManager.resetCursorAndDb().then(function() {
        startSync(true);
      }).catch(function(err) {
        startSync(true);
      });
    break;
    default:
      logger.error('Uncaught sync error. restarting sync', {
        category: 'main',
        error,
        url,
        line,
        errorMsg: message
      });

      endSync();
      startSync(true);
  }
});

/** Development Methods **/
if(env.name === 'development') {
  process.on('unhandledRejection', r => console.log(r));
}

if (process.platform === 'darwin' && app.dock && env.name === 'production') {
  //hide from dock on OSX in production
  app.dock.hide();
}

function startSync(forceFullSync) {
  logger.debug('start sync requested', {category: 'main', forceFullSync});

  if(!sync) {
    sync = SyncCtrl(env, tray);
  }

  if(appState.get('onLineState') === true) {
    sync.start(forceFullSync);
  } else {
    logger.info('not starting Sync because client is offline', {
      category: 'main',
    });
  }
}

function endSync() {
  sync.endFullSync();
}
