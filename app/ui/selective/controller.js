const path = require('path');

const {BrowserWindow, ipcMain} = require('electron');
const url = require('url');

const logger = require('../../lib/logger.js');
const windowStatesFactory = require('../window-states.js');


var selectiveWindow;

module.exports = function(env, clientConfig) {
  windowStates = windowStatesFactory(env);

  function close() {
    logger.info('Close requested', {category: 'selective'});

    if(selectiveWindow) {
      if(env.name === 'development') {
        selectiveWindow.closeDevTools();
      }

      selectiveWindow.close();
    }
  }

  function open() {
    logger.info('Open requested', {category: 'selective'});
    if(!selectiveWindow) selectiveWindow = createWindow();

    selectiveWindow.show();
    selectiveWindow.focus();

    //TODO pixtron - is it possible to have a generic "request secret method?"
    ipcMain.on('selective-window-loaded',function(){
      selectiveWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
    });
  }

  function createWindow() {
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
      icon: __dirname+'/../../img/logo-512x512.png'
    });

    selectiveWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    selectiveWindow.setMenu(null);

    selectiveWindow.on('closed', (event) => {
      selectiveWindow = null;

      windowStates.closed('selective');

      logger.info('Closed', {category: 'selective'});
    });

    selectiveWindow.on('show', (event) => {
      windowStates.opened('selective');

      logger.info('Opened', {category: 'selective'});
    });


    if(env.name === 'development') {
      selectiveWindow.openDevTools();
    }

    return selectiveWindow;
  }

  return {
    close,
    open
  }
}
