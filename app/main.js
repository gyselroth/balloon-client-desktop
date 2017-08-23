//for powerMonitor as it is only available after app.ready
const electron = require('electron');
const {app, ipcMain} = require('electron');

const env = require('./env.js');
const clientConfig = require('./lib/config.js');

if(env.commandLineSwitches && env.commandLineSwitches.authServerWhitelist) {
  app.commandLine.appendSwitch('auth-server-whitelist', env.commandLineSwitches.authServerWhitelist);
}

const TrayCtrl = require('./ui/tray/controller.js');
const SettingsCtrl = require('./ui/settings/controller.js');
const SyncCtrl = require('./lib/sync/controller.js');
const StartupCtrl = require('./ui/startup/controller.js');
const AuthCtrl = require('./lib/auth/controller.js');
const AutoUpdateCtrl = require('./lib/auto-update/controller.js');
const FeedbackCtrl = require('./ui/feedback/controller.js');
const AboutCtrl = require('./ui/about/controller.js');

const logger = require('./lib/logger.js');
const loggerFactory = require('./lib/logger-factory.js');
const configManager = require('./lib/config-manager/controller.js')(clientConfig);

var tray, sync, settings, feedback, autoUpdate;

var standardLogger = new loggerFactory(clientConfig.getAll());
var startup = StartupCtrl(env, clientConfig);
var auth = AuthCtrl(env, clientConfig);

//TODO: raffis - this wont work with first start and memory config
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
  auth.retrieveLoginSecret().then(() => {
    ipcMain.once('tray-online-state-changed', function(event, state) {
      if(clientConfig.hadConfig()) {
        tray.create();
        autoUpdate.checkForUpdate();
      }

      logger.info('Main: initial online state', {state});
      clientConfig.set('onLineState', state);
      startup.checkConfig().then(() => {
        logger.info('startup checkconfig successfull');
      
        if(!tray.isRunning()) {
          tray.create();
        }

        sync = SyncCtrl(env, tray);

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
      }).catch((error) => {
        logger.error('startup checkconfig', {error});
        app.quit();
      });
    });

    tray = TrayCtrl(env, clientConfig);
    settings = SettingsCtrl(env);
    about = AboutCtrl(env, clientConfig);
    autoUpdate = AutoUpdateCtrl(env, clientConfig, tray, about);
    feedback = FeedbackCtrl(env, clientConfig, sync);
  });
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
  logger.info('Main: logout requested');
  //clientConfig.set('disableAutoAuth', true);

  Promise.all([
    auth.logout(),
    (function() {
      if(!sync) return Promise.resolve();

      return sync.pause(true);
    }())
  ]).then(() => {
    logger.info('Main: logout successfull');
    event.sender.send('unlink-account-result', true);
    tray.toggleState('loggedout', true);
  }).catch((err) => {
    logger.error('Main: logout not successfull', err);
    event.sender.send('unlink-account-result', false);
  });
});

ipcMain.on('link-account', (event, id) => {
  logger.info('Main: login requested');
  startup.checkConfig().then(() => {
    clientConfig.set('disableAutoAuth', false);
    logger.info('Main: login successfull', clientConfig.getMulti(['disableAutoAuth', 'username', 'loggedin']));

    if(env.name === 'production') {
      startSync();
    }

    tray.toggleState('loggedout', false);
    event.sender.send('link-account-result', true);
  }).catch((err) => {
    if(err.code !== 'E_BLN_OAUTH_WINDOW_OPEN') {
      logger.error('Main: login not successfull', {err});
    } else {
      logger.info('Main: login aborted as there is already a login window open');
    }

    event.sender.send('link-account-result', false);
  });
});

ipcMain.on('sync-error', (event, error, url, line) => {
  switch(error.code) {
    case 'E_BLN_API_REQUEST_UNAUTHORIZED':
      endSync();
      tray.toggleState('loggedout', true);

      if(clientConfig.get('disableAutoAuth')) return;

      auth.login(startup.askCredentials).then(() => {
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
  if(clientConfig.get('onLineState') === true) {
    sync.start();
  } else {
    logger.info('Not starting Sync because client is offline');
  }
}

function endSync() {
  sync.end();
}
