const url = require('url');
const path = require('path');
const {app, ipcMain, BrowserWindow} = require('electron');
const logger = require('../../lib/logger.js');
const clientConfig = require('../../lib/config.js');
const {BalloonBurlHandler} = require('../../lib/burl.js');
const burlHandler = new BalloonBurlHandler(clientConfig);

module.exports = function(tray) {
  ipcMain.on('burl-open', (event, burl) => {
    burlHandler.handleBurl(burl);
    tray.hide();
  });

  ipcMain.on('burl-not-open', () => {
    tray.hide();
  });

  const showBurl = (burlPath) => {
    return new Promise((resolve, reject) => {
      burlHandler.extractBurl(burlPath).then((burl) => {
        tray.webContents.send('set-burl', burl);
        tray.webContents.send('set-error', null);
        tray.webContents.send('show-burl', burlPath);
        resolve();
      }).catch((error) => {
        tray.webContents.send('set-burl', error.burl);
        tray.webContents.send('set-error', error.error);
        tray.webContents.send('show-burl', burlPath);
        resolve();
      });
    });
  };

  return {
    showBurl
  };
}
