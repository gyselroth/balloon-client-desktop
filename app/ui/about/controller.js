const os = require('os');
const fs = require('graceful-fs');
const path = require('path');
const extend = require('util')._extend;

const {app, ipcMain, BrowserWindow} = require('electron');
const async = require('async');
const archiver = require('archiver');
const request = require('request');


const logger = require('../../lib/logger.js');
const fsInfo = require('../../lib/fs-info.js');

const url = require('url');
const windowStatesFactory = require('../window-states.js');

var aboutWindow;

module.exports = function(env, clientConfig, sync) {
  windowStates = windowStatesFactory(env);

  function close() {
    logger.info('about: close requested');
    if(aboutWindow) aboutWindow.close();
  }

  function open() {
    logger.info('about: open requested');
    if(!aboutWindow) aboutWindow = createWindow();

    aboutWindow.show();
    aboutWindow.focus();
  }

  function createWindow() {
    if(aboutWindow) return aboutWindow;

    aboutWindow = new BrowserWindow({
      width: 300,
      height: 350,
      show: false,
      frame: true,
      fullscreenable: false,
      resizable: false,
      transparent: false,
      skipTaskbar: false,
      icon: __dirname+'/../../img/taskbar_black.png'
    });

    aboutWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    aboutWindow.setMenu(null);

    aboutWindow.on('closed', (event) => {
      aboutWindow = null;

      windowStates.closed('about');

      logger.info('Feedback: closed');
    });

    aboutWindow.on('show', (event) => {
      windowStates.opened('about');

      logger.info('about: opened');
    });

    aboutWindow.on('focus', (event) => {
      aboutWindow.webContents.send('update-window');
    });

    if(env.name === 'development') {
      //aboutWindow.openDevTools();
    }

    ipcMain.on('about-send', (event, text, file) => {
      send(text, file).then(function(reportDir, reportPath) {
        logger.error('about: sending about successfull');
        event.sender.send('about-send-result', true);
      }).catch(function(err) {
        logger.error('about: got error while sending about', {err});
        event.sender.send('about-send-result', false);
      });
    });

    return aboutWindow;
  }

  return {
    close,
    open
  }
}
