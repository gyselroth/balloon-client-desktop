const path = require('path');
const os = require('os');

const electron = require('electron');
const {app, BrowserWindow, ipcMain, nativeImage, Tray} = require('electron');
const positioner = require('electron-traywindow-positioner');

const url = require('url');
const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');

const animationSpeed = 1000/24; //24 fps

const feedback = require('../feedback/controller.js');
const burlCtrl = require('../burl/controller.js');

const stateIconNameMap = {
  default: 'default',
  sync: 'sync',
  offline: 'error',
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
      path: 'icon-tray-blue-16x16.png',
      animate: false,
      template: false
    },
    sync: {
      path: 'icon-tray-blue-16x16-frame%d.png',
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
};

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

const trayWindowHeight = 410;
const trayWindowWidth = 500;

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
    icon.setTemplateImage(true);
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

function getIcon() {
  const iconConfig = getIconConfig('default');
  const iconPath = getIconPath(iconConfig);
  return nativeImage.createFromPath(iconPath);
}


module.exports = function(env, clientConfig) {
  var trayWindow = createWindow();
  const burlController = burlCtrl(trayWindow);

  function create() {
    if(!tray) {
      const icon = getIcon();

      tray = new Tray(icon);
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

  function show(inTray = true) {
    if(!trayWindow) trayWindow = createWindow(inTray);


    //UPDATE ACCESS_TOKEN

    trayWindow.webContents.send('update-window');
    positioner.position(trayWindow, tray.getBounds());
    trayWindow.setAlwaysOnTop(true);
    trayWindow.show();
    trayWindow.focus();
  }

  function showBurl(burlPath) {
    burlController.showBurl(burlPath).then(() => {
      show();
    }).catch((error) => {
      logger.error(error, {category: 'tray'});
    });

  }

  function createWindow(inTray = true) {
    if(trayWindow) {
        trayWindow.setSkipTaskbar(inTray);
        return trayWindow;
    }

    trayWindow = new BrowserWindow({
      width: trayWindowWidth,
      height: trayWindowHeight,
      show: false,
      frame: !inTray,
      icon: getIcon(),
      fullscreenable: false,
      resizable: false,
      transparent: true,
      skipTaskbar: inTray
    });

    trayWindow.setMenu(null);

    trayWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    trayWindow.on('blur', () => {
      if (!trayWindow.webContents.isDevToolsOpened() && process.platform !== 'linux') {
        trayWindow.hide();
      }
    });

    if(env.name === 'development') {
      trayWindow.openDevTools();
    }

    return trayWindow;
  }

  function emit(key, message) {
    if(trayWindow) trayWindow.webContents.send(key, message);
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
  }

  function syncTransferStarted() {
    toggleState('sync', true);
  }

  function syncEnded() {
    if(trayWindow && trayWindow.isDestroyed() === false) {
      trayWindow.webContents.send('sync-ended');
    }

    toggleState('sync', false);
  }

  function syncTransferEnded() {
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

  function update(state) {
    if(trayWindow && trayWindow.isDestroyed() === false) {
      trayWindow.webContents.send(state);
    }
  }

  return {
    create,
    isRunning,
    toggle,
    hide,
    show,
    showBurl,
    syncStarted,
    syncTransferStarted,
    syncEnded,
    syncTransferEnded,
    isWindowVisible,
    syncPaused,
    toggleState,
    updateSecret,
    emit,
    update
  }
}
