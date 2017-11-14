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
    logger.info('close window requested', {category: 'about'});

    if(aboutWindow) aboutWindow.close();
  }

  function open() {
    logger.info('open window requested', {category: 'about'});
    if(!aboutWindow) aboutWindow = createWindow();

    aboutWindow.show();
    aboutWindow.focus();
  }

  function createWindow() {
    if(aboutWindow) return aboutWindow;

    aboutWindow = new BrowserWindow({
      width: 450,
      height: 550,
      show: false,
      frame: true,
      fullscreenable: false,
      resizable: false,
      transparent: false,
      skipTaskbar: false,
      icon: __dirname+'/../../img/logo-512x512.png'
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

      logger.debug('window closed', {category: 'about'});
    });

    aboutWindow.on('show', (event) => {
      windowStates.opened('about');

      logger.info('window opened', {category: 'about'});
    });

    aboutWindow.on('focus', (event) => {
      aboutWindow.webContents.send('update-window');
    });

    if(env.name === 'development') {
      //aboutWindow.openDevTools();
    }

    return aboutWindow;
  }

  function update(state) {
    if(aboutWindow) {
      aboutWindow.webContents.send(state);
    }
  }

  return {
    close,
    open,
    update
  }
}
