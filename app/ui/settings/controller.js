const path = require('path');

const {BrowserWindow} = require('electron');
const url = require('url');

const logger = require('../../lib/logger.js');
const windowStatesFactory = require('../window-states.js');

var settingsWindow;

module.exports = function(env) {
  windowStates = windowStatesFactory(env);

  function close() {
    logger.info('Settings: close requested');
    if(settingsWindow) settingsWindow.close();
  }

  function open() {
    logger.info('Settings: open requested');
    if(!settingsWindow) settingsWindow = createWindow();

    settingsWindow.show();
    settingsWindow.focus();
  }

  function createWindow() {
    if(settingsWindow) return settingsWindow;

    settingsWindow = new BrowserWindow({
      width: 720,
      height: 530,
      show: false,
      frame: true,
      fullscreenable: false,
      resizable: false,
      transparent: false,
      skipTaskbar: false,
      icon: __dirname+'/../../img/logo-512x512.png'
    });

    settingsWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    settingsWindow.setMenu(null);

    settingsWindow.on('closed', (event) => {
      settingsWindow = null;

      windowStates.closed('settings');

      logger.info('Settings: closed');
    });

    settingsWindow.on('show', (event) => {
      windowStates.opened('settings');

      logger.info('Settings: opened');
    });

    settingsWindow.on('focus', (event) => {
      settingsWindow.webContents.send('update-window');
    });

    if(env.name === 'development') {
      settingsWindow.openDevTools();
    }

    return settingsWindow;
  }

  return {
    close,
    open
  }
}
