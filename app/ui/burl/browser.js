const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const shell = electron.shell;

const url = require('url');

const env = require('../../env.js');
const clientConfig = require('../../lib/config.js');
const appState = require('../../lib/state.js');

const i18n = require('../../lib/i18n.js');
const app = electron.remote.app;

const logger = require('../../lib/logger.js');
const loggerFactory = require('../../lib/logger-factory.js');
var standardLogger = new loggerFactory(clientConfig.getAll());
logger.setLogger(standardLogger);


module.exports = function() {
  let burl = null;
  let error = null;

  ipcRenderer.on('set-burl', (event, _burl) => {
    burl = _burl;
  });

  ipcRenderer.on('set-error', (event, _error) => {
    error = _error;
  });

  const context = () => {
    let _error = error ? 'burl.' + error : null;

    return {
      burl: burl,
      error: _error,
    };
  };

  const init = () => {
    let $burlOpen = $('#burl-open');
    let $burlNotOpen = $('#burl-not-open');
    if ($burlOpen) {
      $burlOpen.click(() => {
        ipcRenderer.send('burl-open', burl);
      });
    }
    $burlNotOpen.click(() => {
      ipcRenderer.send('burl-not-open');
    });
  };

  return {
    init,
    context,
  }
}
