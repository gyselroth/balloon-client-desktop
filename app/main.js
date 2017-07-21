//for powerMonitor as it is only available after app.ready
const electron = require('electron');
const {app, ipcMain} = require('electron');

const env = require('./env.js');
const clientConfig = require('./lib/config.js');

if(env.commandLineSwitches.authServerWhitelist) {
  app.commandLine.appendSwitch('auth-server-whitelist', env.commandLineSwitches.authServerWhitelist);
}

const TrayCtrl = require('./ui/tray/controller.js');
const SettingsCtrl = require('./ui/settings/controller.js');
const SyncCtrl = require('./lib/sync/controller.js');
const StartupCtrl = require('./ui/startup/controller.js');
const AuthCtrl = require('./lib/auth/controller.js');
const AutoUpdateCtrl = require('./lib/auto-update/controller.js');
const ErrorReportCtrl = require('./lib/error-report/controller.js');

const logger = require('./lib/logger.js');
const loggerFactory = require('./lib/logger-factory.js');
const configManager = require('./lib/config-manager/controller.js')(clientConfig);



var tray, sync, settings, errorReport, autoUpdate;

var standardLogger = new loggerFactory(clientConfig.getAll());
var startup = StartupCtrl(env, clientConfig);
var auth = AuthCtrl(env, clientConfig);

clientConfig.set('updateAvailable', false);

logger.setLogger(standardLogger);

process.on('uncaughtException', function(exception) {
  logger.error('Main: uncaught exception', exception);
});

var shouldQuit = app.makeSingleInstance((cmd, cwd) => {});

if(shouldQuit === true) {
  startup.showBalloonDir();
  app.quit();
  return;
}

app.on('ready', function () {
  logger.info('App ready');

  ipcMain.once('tray-online-state-changed', function(event, state) {
    autoUpdate.checkForUpdate();

    tray.create();
    logger.info('Main: initial online state', {state});
    clientConfig.set('onLineState', state);
    startup.checkConfig().then(() => {
      logger.info('startup checkconfig successfull');

      function startUp() {
        //tray.create();
        sync = SyncCtrl(env, tray);

        //startup.showBalloonDir();

        if(env.name === 'production') {
          startSync();
        }

        electron.powerMonitor.on('suspend', () => {
          logger.info('The system is going to sleep');

          //abort a possibly active sync if not already paused
          if(sync && sync.isPaused() === false) sync.pause(true);
        });

        electron.powerMonitor.on('resume', () => {
          logger.info('The system is resuming');

          if(env.name === 'production') {
            startSync();
          }
        });
      }

      if(startup.isFirstStart()) {
        auth.login().then(() => {
          startup.welcomeWizard().then(() => {
            startUp();
          });
        });
      } else {
        startUp();
      }
    }).catch(err => {
      logger.error('startup checkconfig', err);
      app.quit();
    });
  });

  tray = TrayCtrl(env);
  settings = SettingsCtrl(env);
  autoUpdate = AutoUpdateCtrl(env, clientConfig, tray);
  errorReport = ErrorReportCtrl(env, clientConfig, sync);
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
  logger.info('Main: online state changed', {state});
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
  logger.info('Main: install-update triggered');
  autoUpdate.quitAndInstall();
});

ipcMain.on('check-for-update', function() {
  logger.info('Main: check-for-update triggered');
  autoUpdate.checkForUpdate();
});

/** Sync **/
ipcMain.on('sync-start', () => {
  startSync();
});

ipcMain.on('sync-complete', () => {
  endSync();
});

ipcMain.on('sync-toggle-pause', () => {
  tray.toggleState('pause', !sync.isPaused());
  sync.togglePause();
});

/** Settings **/
ipcMain.on('settings-open', () => {
  settings.open();
});

ipcMain.on('settings-close', () => {
  settings.close();
});

ipcMain.on('settings-send-error-report', (event) => {
  errorReport.send().then(function(reportDir, reportPath) {
    logger.error('Main: sending error report successfull');
    event.sender.send('settings-send-error-report-result', true);
  }).catch(function(err) {
    logger.error('Main: got error while sending error report', err);
    event.sender.send('settings-send-error-report-result', false);
  });
});

ipcMain.on('settings-logout-requested', (event) => {
  logger.info('Main: logout requested');

  clientConfig.set('disableAutoAuth', true);

  Promise.all([
    auth.logout(),
    (function() {
      if(!sync) return Promise.resolve();

      return sync.pause(true);
    }())
  ]).then(() => {
    logger.info('Main: logout successfull');
    event.sender.send('settings-logout-requested-result', true);
    tray.toggleState('loggedout', true);
  }).catch((err) => {
    logger.error('Main: logout not successfull', err);
    event.sender.send('settings-logout-requested-result', false);
  });
});

ipcMain.on('settings-login-requested', (event, id) => {
  logger.info('Main: login requested');
  auth.login().then(() => {
    clientConfig.set('disableAutoAuth', false);
    logger.info('Main: login successfull', clientConfig.getMulti(['disableAutoAuth', 'username', 'loggedin']));

    startSync();
    tray.toggleState('loggedout', false);
    event.sender.send('settings-login-requested-result-'+id, true);
  }).catch((err) => {
    if(err.code !== 'E_BLN_OAUTH_WINDOW_OPEN') {
      logger.error('Main: login not successfull', err);
    } else {
      logger.info('Main: login aborted as there is already a login window open');
    }

    event.sender.send('settings-login-requested-result-'+id, false);
  });
});


ipcMain.on('sync-error', (event, error, url, line) => {
  switch(error.code) {
    case 'E_BLN_API_REQUEST_UNAUTHORIZED':
      endSync();
      tray.toggleState('loggedout', true);

      if(clientConfig.get('disableAutoAuth')) return;

      auth.login().then(() => {
        logger.info('Main: successfully re-authenticated');
        tray.toggleState('loggedout', false);
        startSync();
      }).catch(err => {
        logger.error('Main: re-authentication failed', {err});
        app.quit();
      });
    break;
    case 'E_BLN_CONFIG_CREDENTIALS':
    case 'E_BLN_CONFIG_BALLOONDIR':
    case 'E_BLN_CONFIG_CONFIGDIR':
    case 'E_BLN_CONFIG_CONFIGDIR_NOTEXISTS':
      //this should only happen, when user deletes the configuation, while the application is running
      logger.info('Main: reinitializing config. Error was:', {code: error.code});
      clientConfig.initialize();
      endSync();
      startSync();
    break;
    case 'E_BLN_CONFIG_CONFIGDIR_ACCES':
      logger.error('Main: config dir not accesible.', {error});
      endSync();
    break;
    default:
      logger.error('Uncaught sync error. Resetting cursor and db', {error, url, line});

      configManager.resetCursorAndDb().then(function() {
        if(env.name === 'production') {
          endSync();
          startSync();
        }
      }).catch(function(err) {
        if(env.name === 'production') {
          endSync();
          startSync();
        }
      });
  }
});


/** Development Methods **/
if(env.name === 'development') {
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
  if(auth.hasAccessToken() === false || auth.accessTokenExpired()) {
    tray.toggleState('loggedout', true);

    if(clientConfig.get('disableAutoAuth') !== true && clientConfig.get('onLineState') === true) {
      auth.login().then(result => {
        tray.toggleState('loggedout', false);
        sync.start();
      }).catch(err => {
        logger.error('Main login failed:', err);
      });
    } else {
      endSync();
    }
  } else {
    if(clientConfig.get('onLineState') === true) {
      sync.start();
    } else {
      logger.info('Not starting Sync because client is offline');
    }
  }
}

function endSync() {
  sync.end();
}
