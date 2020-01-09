const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const shell = electron.shell;

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
  function context() {
    return {
      version: app.getVersion()
    };
  }

  function init() {
    if(process.platform !== 'linux') {
      var $check = $('#about-version-check').click(function(){
        $('#about').find('.loader').show();
        $(this).hide();
        ipcRenderer.send('check-for-update');
      });

      var $install = $('#about-version-install').click(function(){
        ipcRenderer.send('install-update');
      });

      var $downloading = $('#about-update-downloading');

      if(env.update && env.update.enable === true || !env.update || env.update.enable === undefined) {
        if(appState.get('updateAvailable')) {
          $install.show();
          $check.hide();
        } else if(appState.get('updateDownloading')) {
          $downloading.show();
          $check.hide();
        } else {
          $install.hide();
          $check.show();
        }
      }
    }

    $('#about-gyselroth').click(function(){
      shell.openExternal('https://gyselroth.com');
    });

    $('#about-github').click(function(){
      shell.openExternal('https://github.com/gyselroth/balloon-client-desktop');
    });

    ipcRenderer.on('error', () => {
      $('#about .about-update-message').hide();
      $('#about-update-error').show();
      $('#about').find('.loader').hide();
    });

    ipcRenderer.on('update-downloaded', () => {
      $('#about .about-update-message').hide();
      $('#about-version-install').show();
      $('#about').find('.loader').hide();
    });

    ipcRenderer.on('update-not-available', () => {
      $('#about .about-update-message').hide();
      $('#about-update-not-available').show();
      $('#about').find('.loader').hide();
    });

    ipcRenderer.on('update-available', () => {
      $('#about .about-update-message').hide();
      $('#about-update-downloading').show();
      $('#about').find('.loader').hide();
    });

    ipcRenderer.on('update-download-progress', (event, progress) => {
      console.log(progress, event);
      const percent = `${parseInt(progress.percent)}%`;
      $('#about-update-downloading span:nth-child(2)').html(percent).show();
    });
  }

  return {
    init,
    context
  }
}
