//for powerMonitor as it is only available after app.ready
const electron = require('electron');
const {app, ipcMain} = require('electron');

const env = require('./env.js');
const clientConfig = require('./lib/config.js');
const migrate = require('./lib/migrate.js');
const TrayCtrl = require('./ui/tray/controller.js');
const SettingsCtrl = require('./ui/settings/controller.js');
const SyncCtrl = require('./lib/sync/controller.js');
const StartupCtrl = require('./ui/startup/controller.js');
const AuthCtrl = require('./lib/auth/controller.js');
const AutoUpdateCtrl = require('./lib/auto-update/controller.js');
const FeedbackCtrl = require('./ui/feedback/controller.js');
const AboutCtrl = require('./ui/about/controller.js');
const setMenu = require('./lib/menu.js');

const logger = require('./lib/logger.js');
const loggerFactory = require('./lib/logger-factory.js');
const configManager = require('./lib/config-manager/controller.js')(clientConfig);

var tray, sync, settings, feedback, autoUpdate;

var standardLogger = new loggerFactory(clientConfig.getAll());
var startup = StartupCtrl(env, clientConfig);
var auth = AuthCtrl(env, clientConfig);

//TODO: raffis: this wont work with first start and memory config
clientConfig.set('updateAvailable', false);

logger.setLogger(standardLogger);

process.on('uncaughtException', function(exception) {
  logger.error('uncaught exception', {
    category: 'bootstrap',
    error: exception
  });
});

var shouldQuit = app.makeSingleInstance((cmd, cwd) => {});

if(shouldQuit === true) {
  startup.showBalloonDir();
  app.quit();
}

function startApp() {
  auth.retrieveLoginSecret().then(() => {
    ipcMain.once('tray-online-state-changed', function(event, state) {
      if(clientConfig.hadConfig()) {
        tray.create();
        autoUpdate.checkForUpdate();
      }

      logger.info('initial online state', {
        category: 'bootstrap',
        state: state
      });

      clientConfig.set('onLineState', state);
      startup.checkConfig().then(() => {
        logger.info('startup checkconfig successfull', {
          category: 'bootstrap',
        });

        if(!tray.isRunning()) {
          tray.create();
        }

        sync = SyncCtrl(env, tray);

        if(env.name === 'production') {
          startSync();
        }

        electron.powerMonitor.on('suspend', () => {
          logger.info('The system is going to sleep', {
            category: 'bootstrap',
          });

          //abort a possibly active sync if not already paused
          if(sync && sync.isPaused() === false) sync.pause(true);
        });

        electron.powerMonitor.on('resume', () => {
          logger.info('The system is resuming', {
            category: 'bootstrap',
          });

          if(env.name === 'production') {
            startSync();
          }
        });
      }).catch((error) => {
        logger.error('startup checkconfig', {
            category: 'bootstrap',
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
    settings = SettingsCtrl(env);
    about = AboutCtrl(env, clientConfig);
    autoUpdate = AutoUpdateCtrl(env, clientConfig, tray, about);
    feedback = FeedbackCtrl(env, clientConfig, sync);
  });
}

function unlinkAccount() {
  return Promise.all([
    auth.logout(),
    (function() {
      if(!sync) return Promise.resolve();

      return sync.pause(true);
    }())
  ]).then(() => {
    logger.info('logout successfull', {
      category: 'bootstrap',
    });

    tray.emit('unlink-account-result', true);
    tray.toggleState('loggedout', true);
  }).catch((error) => {
    logger.error('logout not successfull', {
      category: 'bootstrap',
      error: error
    });

    tray.emit('unlink-account-result', false);
  });
}

app.on('ready', function () {
  logger.info('App ready', {
      category: 'bootstrap',
  });

  setMenu();

  migrate().then(result => {
    startApp();
  }).catch(err => {
    logger.error('error during migration, quitting app', {
      category: 'bootstrap',
      error: err
    });

    app.quit();
  })
});

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
    category: 'bootstrap',
    state: state
  });

  clientConfig.set('onLineState', state);
  if(state === false) {
    //abort a possibly active sync if not already paused
    if(sync && sync.isPaused() === false) sync.pause(true);
    tray.toggleState('offline', true);
  } else {
    if(sync && sync.isPaused() === false) startSync();
    tray.toggleState('offline', false);
  }
});


/** Auto update **/
ipcMain.on('install-update', function() {
  logger.info('install-update triggered', {
    category: 'bootstrap',
  });

  autoUpdate.quitAndInstall();
});

ipcMain.on('check-for-update', function() {
  logger.info('check-for-update triggered', {
      category: 'bootstrap',
  });

  autoUpdate.checkForUpdate();
});

/** Sync **/
ipcMain.on('sync-start', () => {
  startSync();
});

ipcMain.on('sync-complete', () => {
  endSync(true);
});

ipcMain.on('sync-transfer-start', () => {
  tray.syncTransferStarted();
});

ipcMain.on('sync-transfer-end', () => {
  tray.syncTransferEnded();
});

ipcMain.on('sync-toggle-pause', () => {
  if(env.name === 'development') return;

  if(!sync) {
    return tray.syncPaused();
  }

  tray.toggleState('pause', !sync.isPaused());
  sync.togglePause();
});

ipcMain.on('settings-open', () => {
  settings.open();
});

ipcMain.on('settings-close', () => {
  settings.close();
});

ipcMain.on('feedback-open', (event) => {
  feedback.open();
});

ipcMain.on('about-open', (event) => {
  about.open();
});

ipcMain.on('unlink-account', (event) => {
  logger.info('logout requested', {category: 'bootstrap'});
  unlinkAccount();
});

ipcMain.on('link-account', (event, id) => {
  logger.info('login requested', {category: 'bootstrap'});

  startup.checkConfig().then(() => {
    logger.info('login successfull', {
      category: 'bootstrap',
      data: clientConfig.getMulti(['username', 'loggedin'])
    });

    clientConfig.updateTraySecret();

    tray.toggleState('loggedout', false);
    startSync();
    event.sender.send('link-account-result', true);
  }).catch((err) => {
    if(err.code !== 'E_BLN_OAUTH_WINDOW_OPEN') {
      logger.error('login not successfull', {
        category: 'bootstrap',
        error: err
      });
    } else {
      logger.info('login aborted as there is already a login window open', {
        category: 'bootstrap',
      });
    }

    event.sender.send('link-account-result', false);
  });
});

ipcMain.on('sync-error', (event, error, url, line, message) => {
  switch(error.code) {
    case 'E_BLN_API_REQUEST_UNAUTHORIZED':
      logger.info('got 401, end sync and unlink account', {category: 'bootstrap'});

      endSync(false);
      unlinkAccount();
    break;
    case 'E_BLN_CONFIG_CREDENTIALS':
      logger.error('credentials not set', {
        category: 'bootstrap',
        code: error.code
      });

      endSync(false);
      unlinkAccount();
    break;
    case 'E_BLN_CONFIG_BALLOONDIR':
    case 'E_BLN_CONFIG_CONFIGDIR':
    case 'E_BLN_CONFIG_CONFIGDIR_NOTEXISTS':
      //this should only happen, when user deletes the configuation, while the application is running
      logger.info('reinitializing config. Error was:', {
        category: 'bootstrap',
        code: error.code
      });

      clientConfig.initialize();
      endSync(true);
    break;
    case 'E_BLN_CONFIG_CONFIGDIR_ACCES':
      logger.error('config dir not accesible.', {
        category: 'bootstrap',
        error
      });
      endSync(false);
    break;
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case 'ENETUNREACH':
    case 'EHOSTUNREACH':
    case 'ECONNREFUSED':
    case 'EHOSTDOWN':
      logger.error('sync terminated with networkproblems.', {
        category: 'bootstrap',
        code: error.code
      });
      endSync(false);
      tray.emit('network-offline');
    break;
    default:
      logger.error('Uncaught sync error. Resetting cursor and db', {
        category: 'bootstrap',
        error,
        url,
        line,
        errorMsg: message
      });

      configManager.resetCursorAndDb().then(function() {
        if(env.name === 'production') {
          endSync(true);
        }
      }).catch(function(err) {
        if(env.name === 'production') {
          endSync(true);
        }
      });
  }
});

/** Development Methods **/
if(env.name === 'development') {
  process.on('unhandledRejection', r => console.log(r));

  ipcMain.on('dev-reset', (event) => {
    configManager.reset().then(() => {
      event.sender.send('dev-reset-complete');
    }).catch(err => {
      event.sender.send('dev-reset-complete', err);
    });
  });
}

if (process.platform === 'darwin' && app.dock && env.name === 'production') {
  //hide from dock on OSX in production
  app.dock.hide();
}

function startSync() {
  if(!sync) {
    sync = SyncCtrl(env, tray);
  }

  if(clientConfig.get('onLineState') === true) {
    sync.start();
  } else {
    logger.info('Not starting Sync because client is offline', {
      category: 'bootstrap',
    });
  }
}

function endSync(scheduleNextSync) {
  sync.end(scheduleNextSync);
}
