const url = require('url');
const path = require('path');
const {app, ipcMain, BrowserWindow} = require('electron');
const logger = require('../../lib/logger.js');
const clientConfig = require('../../lib/config.js');
const {BalloonBurlHandler} = require('../../lib/burl.js');
const burlHandler = new BalloonBurlHandler(clientConfig);

module.exports = function(tray, burlPath) {
  ipcMain.on('burl-open', (burl) => {
    burlHandler.extractBurl(burlPath).then((burl) => {
      burlHandler.handleBurl(burl);
      tray.hide();
    }).catch((error) => {
      logger.error(error, {category: 'burl-prompt'});
    });
  });

  ipcMain.on('burl-not-open', () => {
    tray.hide();
  });

  burlHandler.extractBurl(burlPath).then((burl) => {
    tray.webContents.send('set-burl', burl);
    tray.webContents.send('show-burl', burlPath);
  }).catch((error) => {
    tray.webContents.send('set-burl', error.burl);
    tray.webContents.send('set-error', error.error);
    tray.webContents.send('show-burl', burlPath);
  });
}
