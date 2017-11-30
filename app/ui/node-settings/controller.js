const path                          = require('path')
const {app, BrowserWindow, ipcMain} = require('electron')
const logger                        = require('../../lib/logger.js')
const clientConfig                  = require('../../lib/config.js')
const url                           = require('url')

var nodeSettingsWindow = {};

module.exports = function (env) {
  function close (nodePath) {
    logger.info('close window requested', {category: 'node-settings'});
    if (nodeSettingsWindow[nodePath]) nodeSettingsWindow[nodePath].close()
  }

  function open (nodePath) {
    logger.info('open window requested', {category: 'node-settings'});
    if (!nodeSettingsWindow[nodePath]) nodeSettingsWindow[nodePath] = createWindow(nodePath)

    nodeSettingsWindow[nodePath].show()
    nodeSettingsWindow[nodePath].focus()
  }

  function createWindow (nodePath) {
    if (nodeSettingsWindow[nodePath]) return nodeSettingsWindow[nodePath]

    nodeSettingsWindow[nodePath] = new BrowserWindow({
      width         : 400,
      height        : 350,
      show          : true,
      frame         : true,
      fullscreenable: false,
      resizable     : false,
      skipTaskbar   : true,	  
	  title 		: 'balloon',
      icon          : __dirname + '/../../img/logo-512x512.png'
    })

    nodeSettingsWindow[nodePath].loadURL(url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes : true
    }))

    nodeSettingsWindow[nodePath].setMenu(null)

    nodeSettingsWindow[nodePath].on('closed', (event) => {
      nodeSettingsWindow[nodePath] = null

      logger.debug('window closed', {category: 'node-settings'});
    })

    nodeSettingsWindow[nodePath].on('show', (event) => {
      logger.info('window opened', {category: 'node-settings'});
    })

    nodeSettingsWindow[nodePath].on('focus', (event) => {
      nodeSettingsWindow[nodePath].webContents.send('update-window')
    })

    ipcMain.on('node-settings-window-loaded', () => {
		nodeSettingsWindow[nodePath].webContents.send('node-settings-window-init', clientConfig.getSecretType(), clientConfig.getSecret(), nodePath);
    });

    if (env.name === 'development') {
       //nodeSettingsWindow[nodePath].openDevTools()
    }

    return nodeSettingsWindow[nodePath]
  }

  return {
    close,
    open
  }
}
