const os   = require('os')
const fs   = require('graceful-fs')
const path = require('path')

const {app, ipcMain, BrowserWindow} = require('electron')
const async                         = require('async')
const archiver                      = require('archiver')
const request                       = require('request')

const logger              = require('../../lib/logger.js')
const clientConfig        = require('../../lib/config.js')
const url                 = require('url')
const windowStatesFactory = require('../window-states.js')

var nodeSettingsWindow

module.exports = function (env) {
  windowStates = windowStatesFactory(env)

  function close () {
    logger.info('node-settings: close requested')
    if (nodeSettingsWindow) nodeSettingsWindow.close()
  }

  function open (nodePath) {
    clientConfig.set('nodePath', nodePath)
    logger.info('node-settings: open requested ' + nodePath)
    if (!nodeSettingsWindow) nodeSettingsWindow = createWindow(nodePath)

    nodeSettingsWindow.show()
    nodeSettingsWindow.focus()
  }

  function createWindow (nodePath) {
    if (nodeSettingsWindow) return nodeSettingsWindow

    nodeSettingsWindow = new BrowserWindow({
      title         : nodePath,
      // width         : 400,
      width: 1600,
      height        : 800,
      // height: 400,
      show          : true,
      frame         : false,
      fullscreenable: false,
      resizable     : true,
      skipTaskbar   : true,
      icon          : __dirname + '/../../img/logo-512x512.png'
    })

    nodeSettingsWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes : true
    }))

    nodeSettingsWindow.setMenu(null)

    nodeSettingsWindow.on('closed', (event) => {
      nodeSettingsWindow = null

      windowStates.closed('node-settings')

      logger.info('node-settings: closed')

      app.quit();
    })

    nodeSettingsWindow.on('show', (event) => {
      windowStates.opened('node-settings')

      logger.info('node-settings: opened')
    })

    nodeSettingsWindow.on('focus', (event) => {
      nodeSettingsWindow.webContents.send('update-window')
    })

    // if (env.name === 'development') {
      nodeSettingsWindow.openDevTools()
    // }

    return nodeSettingsWindow
  }

  return {
    close,
    open
  }
}
