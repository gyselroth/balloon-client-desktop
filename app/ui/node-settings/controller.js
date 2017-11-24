const path                          = require('path')
const {app, BrowserWindow, ipcMain} = require('electron')
const logger                        = require('../../lib/logger.js')
const clientConfig                  = require('../../lib/config.js')
const url                           = require('url')
const windowStatesFactory           = require('../window-states.js')
const AuthCtrl                      = require('../../lib/auth/controller')

var nodeSettingsWindow

module.exports = function (env) {
  windowStates = windowStatesFactory(env)

  function close () {
    logger.info('close window requested', {category: 'node-settings'});

    if (nodeSettingsWindow) nodeSettingsWindow.close()
  }

  function open (nodePath) {
    logger.info('open window requested', {category: 'node-settings'});
    clientConfig.set('nodePath', nodePath)
    if (!nodeSettingsWindow) nodeSettingsWindow = createWindow()

    nodeSettingsWindow.show()
    nodeSettingsWindow.focus()
  }

  function createWindow () {
    if (nodeSettingsWindow) return nodeSettingsWindow

    nodeSettingsWindow = new BrowserWindow({
      width         : 400,
      minWidth      : 400,
      height        : 280,
      minHeight     : 280,
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

      logger.debug('window closed', {category: 'node-settings'});

      app.quit();
    })

    nodeSettingsWindow.on('show', (event) => {
      windowStates.opened('node-settings')

      logger.info('window opened', {category: 'node-settings'});
    })

    nodeSettingsWindow.on('focus', (event) => {
      nodeSettingsWindow.webContents.send('update-window')
    })

    ipcMain.once('node-settings-window-loaded', () => {
      var authCtrl = AuthCtrl(env, clientConfig);
      authCtrl.retrieveLoginSecret().then(() => {
        nodeSettingsWindow.webContents.send('secret', clientConfig.getSecretType(), clientConfig.getSecret());
      });
    });

    if (env.name === 'development') {
      // nodeSettingsWindow.openDevTools()
    }

    return nodeSettingsWindow
  }

  return {
    close,
    open
  }
}
