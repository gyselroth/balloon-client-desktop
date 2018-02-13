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

    ipcMain.on('selective-window-loaded',function(){
      selectiveWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
    });

    ipcMain.removeAllListeners('selective-apply');
    ipcMain.on('selective-apply', function(event, ids) {
      logger.info('apply selective sync settings', {
        category: 'startup',
        data: ids
      });

      let currentlyIgnored = clientConfig.get('ignoreNodes') || [];
      let unignoreIds = currentlyIgnored.filter(node => {
        return ids.indexOf(node) === -1;
      });

      clientConfig.unignoreNode(unignoreIds);
      clientConfig.ignoreNode(ids);

      close();
    });

    ipcMain.removeAllListeners('selective-cancel');
    ipcMain.on('selective-cancel', function(event) {
      logger.info('cancel selective sync settings', {category: 'startup'});
      close();
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
