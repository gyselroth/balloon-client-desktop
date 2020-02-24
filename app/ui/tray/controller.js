const path = require('path');
const os = require('os');

const electron = require('electron');
const {app, BrowserWindow, ipcMain, Menu, nativeImage, Tray} = require('electron');
const positioner = require('electron-traywindow-positioner');

const url = require('url');
const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');
const menuFactory = require('./menu-factory.js');

const animationSpeed = 1000/24; //24 fps

const feedback = require('../feedback/controller.js');

const logger = require('../../lib/logger.js');
const contextMenuFactory = require('../../lib/context-menu-factory.js');

const TRAY_CLICK_SHOW_WINDOW = process.platform !== 'linux';

const stateIconNameMap = {
  default: 'default',
  sync: 'sync',
  offline: 'error',
  disconnected: 'error',
  loggedout: 'error',
  pause: 'warning'
};

const Icons = {
  'win10+': {
    default: {
      path: 'icon-tray-white-16x16.png',
      animate: false,
      template: false
    },
    sync: {
      path: 'icon-tray-white-16x16-frame%d.png',
      animate: true,
      frames: 10,
      template: false
    },
    error: {
      path: 'icon-tray-red-16x16.png',
      animate: false,
      template: false
    },
    warning: {
      path: 'icon-tray-orange-16x16.png',
      animate: false,
      template: false
    }
  },
  darwin: {
    default: {
      path: 'icon-tray-black-16x16.png',
      animate: false,
      template: true
    },
    sync: {
      path: 'icon-tray-black-16x16-frame%d.png',
      animate: true,
      frames: 10,
      template: true
    },
    error: {
      path: 'icon-tray-red-16x16.png',
      animate: false,
      template: false
    },
    warning: {
      path: 'icon-tray-orange-16x16.png',
      animate: false,
      template: false
    }
  },
  default: {
    default: {
      path: 'icon-tray-blue-32x32.png',
      animate: false,
      template: false
    },
    sync: {
      path: 'icon-tray-blue-32x32-sync.png',
      animate: false,
      template: false
    },
    error: {
      path: 'icon-tray-red-32x32.png',
      animate: false,
      template: false
    },
    warning: {
      path: 'icon-tray-orange-32x32.png',
      animate: false,
      template: false
    }
  },
};

const StatePriorities = ['offline', 'disconnected', 'loggedout', 'pause', 'sync', 'update', 'default'];

const currentStates = {
  default: true,
  check: false,
  offline: false,
  loggedout: false,
  disconnected: false,
  pause: false,
  sync: false,
  update: false
}

const trayWindowHeight = 410;
const trayWindowWidth = 500;

let showLogin = true;
let syncStatus = true;

var tray;
var animationTimeout = null;

function toggleState(state, value) {
  currentStates[state] = value;

  changeTrayIcon();
}

function getCurrentState() {
  return StatePriorities.find((state) => {
    return currentStates[state] === true;
  });
}

function changeTrayIcon(frame = 1) {
  if(!tray) return;

  var state = getCurrentState();

  if(animationTimeout) {
    clearTimeout(animationTimeout);
    animationTimeout = null;
  }

  var title = 'Balloon ' + app.getVersion() + '\n';
  var stateDescription = i18n.__('tray.tooltip.state.' + state)
  tray.setToolTip(title + stateDescription);

  const iconConfig = getIconConfig(state);
  const iconPath = getIconPath(iconConfig, frame);
  const icon = nativeImage.createFromPath(iconPath);

  if(iconConfig.template === true && process.platform === 'darwin') {
    icon.isMacTemplateImage = true;
  }

  if(iconConfig.animate) {
    animateIcon(frame, iconConfig.frames);
  }

  tray.setImage(icon);
}

function getIconPath(iconConfig, frame=1) {
  return path.join(__dirname, '../../img/tray-icons', iconConfig.path.replace('%d', frame));
}

function getIconConfig(state = 'default') {
  let iconFamily;

  switch(process.platform) {
    case 'darwin':
      iconFamily = 'darwin';
    break;
    case 'win32':
      var release = os.release();
      if(parseInt(release.split('.')[0]) >= 10) {
        //windows 10, Windows Server 2016 or higher
        iconFamily = 'win10+';
      } else {
        //Windows 8.1, Windows Server 2012 R2 or lower
        iconFamily = 'default';
      }
    break;
    default:
      iconFamily = 'default';
  }

  const iconFamilySet = Icons[iconFamily] ? Icons[iconFamily] : Icons['default'];
  const iconName = stateIconNameMap[state] || 'default';
  const iconConfig = iconFamilySet[iconName] ? iconFamilySet[iconName] : iconFamilySet['default'];

  return iconConfig;
}

function animateIcon(curFrame=1, maxFrames=1) {
  if(curFrame === maxFrames) {
    curFrame = 1;
  } else {
    curFrame ++;
  }

  animationTimeout = setTimeout(function() {
    changeTrayIcon(curFrame);
  }, animationSpeed);
}


module.exports = function(env, clientConfig) {
  var trayWindow = createWindow();

  ipcMain.on('transfer-task', (event, task) => {
    trayWindow.webContents.send('transfer-task', task);
  });

  ipcMain.on('transfer-progress', (event, task) => {
    trayWindow.webContents.send('transfer-progress', task);
  });

  ipcMain.on('transfer-start', (event) => {
    trayWindow.webContents.send('transfer-start');
  });

  function create() {
    if(!tray) {
      const iconConfig = getIconConfig('default');
      const iconPath = getIconPath(iconConfig);
      const icon = nativeImage.createFromPath(iconPath);

      tray = new Tray(icon);
      changeTrayIcon();

      if (TRAY_CLICK_SHOW_WINDOW) {
        tray.on('click', function (event) {
          toggle();
        });
      }

      updateTrayMenu();

      clientConfig.updateTraySecret();
    }
  }

  function toggle() {
    if(!trayWindow) trayWindow = createWindow();

    logger.info('toggle tray window', {category: 'tray', isVisble: trayWindow.isVisible()});

    if(trayWindow.isVisible()) {
      hide();
    } else {
      show();
    }
  }

  function hide() {
    logger.info('hide tray window', {category: 'tray'});

    if(trayWindow) trayWindow.hide();
  }

  function show(menu='status') {
    logger.info('show tray window', {category: 'tray'});

    if(!trayWindow) trayWindow = createWindow();


    //UPDATE ACCESS_TOKEN

    trayWindow.webContents.send('update-window', menu);
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
      skipTaskbar: true,
      webPreferences: {nodeIntegration: true}
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
      trayWindow.openDevTools({ mode: 'detach' });
    }

    contextMenuFactory(trayWindow);

    return trayWindow;
  }

  function loadMenu(menu) {
    if(trayWindow.isVisible()) {
      trayWindow.webContents.send('tray-load-menu', menu);
    } else {
      show(menu);
    }
  }

  function updateTrayMenu() {
    if (TRAY_CLICK_SHOW_WINDOW || !tray) return;

    const menu = menuFactory(loadMenu, clientConfig, showLogin, syncStatus)

    tray.setContextMenu(menu);
  }

  function emit(key, message) {
    if(trayWindow) trayWindow.webContents.send(key, message);

    switch(key) {
      case 'unlink-account-result':
        showLogin = message;
        updateTrayMenu();
      break;
      case 'link-account-result':
        showLogin = !message;
        updateTrayMenu();
      break;
    }
  }

  ipcMain.on('tray-window-loaded', function(){
    clientConfig.setTraySecretCallback(updateSecret);
  });

  function updateSecret() {
    showLogin = (!clientConfig.get('loggedin') || !clientConfig.isActiveInstance())
    trayWindow.webContents.send('config', clientConfig.getSecret(), clientConfig.getSecretType());
    updateTrayMenu()
  }

  function syncPaused() {
    trayWindow.webContents.send('sync-paused');
    syncStatus = false;
    updateTrayMenu();
  }

  function syncResumed() {
    trayWindow.webContents.send('sync-resumed');
    syncStatus = true;
    updateTrayMenu();
  }

  function syncStarted() {
    trayWindow.webContents.send('sync-started');
    toggleState('sync', true);
    syncStatus = true;
    updateTrayMenu();
  }

  function syncEnded() {
    if(trayWindow && trayWindow.isDestroyed() === false) {
      trayWindow.webContents.send('sync-ended');
    }

    toggleState('sync', false);
  }

  function isWindowVisible() {
    return trayWindow ? trayWindow.isVisible() : false;
  }

  function isRunning() {
    if(tray) {
      return true;
    } else {
      return false;
    }
  }

  function update(state, info) {
    if(trayWindow && trayWindow.isDestroyed() === false) {
      trayWindow.webContents.send(state, info);
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
    syncResumed,
    syncPaused,
    isWindowVisible,
    toggleState,
    updateSecret,
    emit,
    update
  }
}
