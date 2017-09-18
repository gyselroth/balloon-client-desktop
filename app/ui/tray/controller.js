const path = require('path');
const os = require('os');

const electron = require('electron');
const {app, BrowserWindow, ipcMain, nativeImage, Tray} = require('electron');
const positioner = require('electron-traywindow-positioner');

const url = require('url');
const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');

const Icons = {
  pngBlack: {
    'default': 'taskbar_black.png',
    'check': 'taskbar_check_black.png',
    'offline': 'taskbar_error_black.png',
    'loggedout': 'taskbar_error_black.png',
    'pause': 'taskbar_pause_black.png',
    'sync': 'taskbar_sync_black.png',
    'update': 'taskbar_error_black.png'
  },
  icoBlack: {
    'default': 'taskbar_black.ico',
    'check': 'taskbar_check_black.ico',
    'offline': 'taskbar_error_black.ico',
    'pause': 'taskbar_pause_black.ico',
    'sync': 'taskbar_sync_black.ico',
    'update': 'taskbar_error_black.ico'
  },
  icoWhite: {
    'default': 'taskbar.ico',
    'offline': 'taskbar_error.ico',
    'loggedout': 'taskbar_error.ico',
    'pause': 'taskbar_pause.ico',
    'sync': 'taskbar_sync.ico',
    'update': 'taskbar_error.ico'
  },
  default: {
    'default': 'tray-icon.png'
  }
}

const StatePriorities = ['offline', 'loggedout', 'pause', 'sync', 'update', 'default'];

const currentStates = {
  default: true,
  check: false,
  offline: false,
  loggedout: false,
  pause: false,
  sync: false,
  update: false
}

const trayWindowWidth = 306;
const trayWindowHeight = 96;

var tray;

function toggleState(state, value) {
  currentStates[state] = value;

  changeTrayIcon();
}

function changeTrayIcon() {
  var state = getCurrentState();

  if(tray) {
    var title = 'Balloon ' + app.getVersion() + '\n';
    var stateDescription = i18n.__('tray.tooltip.state.' + state)
    tray.setToolTip(title + stateDescription);

    tray.setImage(getTrayIcon(state));
  }
}

function getCurrentState() {
  return StatePriorities.find((state) => {
    return currentStates[state] === true;
  });
}

function getTrayIcon(state) {
  var iconPath = getIconPath(state);

  if(process.platform === 'darwin') {
    var image = nativeImage.createFromPath(iconPath);
    image.setTemplateImage(true);
  } else {
    var image = iconPath;
  }

  return image;
}

function getIconPath(state) {
  state = state || 'default';
  var iconFamily;

  switch(process.platform) {
    case 'darwin':
      iconFamily = 'pngBlack';
    break;
    case 'win32':
      var release = os.release();
      if(parseInt(release.split('.')[0]) >= 10) {
        //windows 10, Windows Server 2016 or higher
        iconFamily = 'icoWhite';
      } else {
        //Windows 8.1, Windows Server 2012 R2 or lower
        iconFamily = 'icoBlack';
      }
    break;
    default:
      iconFamily = 'default';
  }

  var iconFamilySet = Icons[iconFamily] ? Icons[iconFamily] : Icons['default'];
  var filename = iconFamilySet[state] ? iconFamilySet[state] : iconFamilySet['default'];

  return path.join(__dirname, '../../img/', filename);;
}

module.exports = function(env, clientConfig) {
  var trayWindow = createWindow();

  function create() {
    if(!tray) {
      tray = new Tray(getTrayIcon('default'));
      changeTrayIcon();

      tray.on('click', function (event) {
        toggle();
      });

      clientConfig.updateTraySecret();
    }
  }

  function toggle() {
    if(!trayWindow) trayWindow = createWindow();
    if(trayWindow.isVisible()) {
      hide();
    } else {
      show();
    }
  }

  function hide() {
    if(trayWindow) trayWindow.hide();
  }

  function show() {
    if(!trayWindow) trayWindow = createWindow();

    trayWindow.webContents.send('update-window');
    positioner.position(trayWindow, tray.getBounds());
    trayWindow.setAlwaysOnTop(true);
    trayWindow.show();
    trayWindow.focus();
  }

  function createWindow() {
    if(trayWindow) return trayWindow;

    trayWindow = new BrowserWindow({
      width: trayWindowWidth,
      height: trayWindowHeight,
      show: false,
      frame: false,
      fullscreenable: false,
      resizable: false,
      transparent: true,
      skipTaskbar: true
    });

    trayWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    trayWindow.on('blur', () => {
      if (!trayWindow.webContents.isDevToolsOpened()) {
        trayWindow.hide()
      }
    });

    if(env.name === 'development') {
      trayWindow.openDevTools();
    }
    
    return trayWindow;    
  }
  
  ipcMain.on('tray-window-loaded', function(){
    clientConfig.setTraySecretCallback(updateSecret);
  });

  function updateSecret() {
    trayWindow.webContents.send('config', clientConfig.getSecret(), clientConfig.getSecretType());
  }
  
  function syncPaused() {
    trayWindow.webContents.send('sync-paused');
  }

  function syncStarted() {
    trayWindow.webContents.send('sync-started');
    toggleState('sync', true);
  }

  function syncEnded() {
    if(trayWindow && trayWindow.isDestroyed() === false) {
      trayWindow.webContents.send('sync-ended');
    }

    toggleState('sync', false);
  }

  function isRunning() {
    if(tray) {
      return true;
    } else {
      return false;
    }
  }

  return {
    create,
    isRunning,
    toggle,
    hide,
    show,
    syncStarted,
    syncEnded,
    syncPaused,
    toggleState,
    updateSecret
  }
}
