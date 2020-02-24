(function() {'use strict';
const os = require('os');

const {ipcRenderer, shell, remote} = require('electron');
const handlebars = require('handlebars');
const request = require('request');

const {fullSyncFactory} = require('@gyselroth/balloon-node-sync');

const i18n = require('../../lib/i18n.js');
const instance = require('../../lib/instance.js');
const menuFactory = require('./menu-factory.js');
const clientConfig = require('../../lib/config.js');
const globalConfig = require('../../lib/global-config.js');
const appState = require('../../lib/state.js');

const modules = {
  settings: require('../settings/browser.js')(),
  feedback: require('../feedback/browser.js')(),
  about: require('../about/browser.js')(),
  status: require('../status/browser.js')(),
}

const logger = require('../../lib/logger.js');
const loggerFactory = require('../../lib/logger-factory.js');
var standardLogger = new loggerFactory(clientConfig.getAll());
logger.setLogger(standardLogger);

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

var sync;
var syncStatus    = true;
var showLogin     = true;

var reconnectTimeout = null;

function loadMenu(menu) {
  logger.info('loadMenu', {category: 'tray-browser', menu});

  $('#tray-main-template').load('../'+menu+'/index.html', function() {
    logger.info('template loaded', {category: 'tray-browser', menu});

    compileMenuTemplate(menu);
    modules[menu].init(sync);
  });
}

function compileMenuTemplate(menu) {
  var templateHtml = $('#tray-main-template').find('.template').html();
  var $placeholder = $('#tray-main');
  var template = handlebars.compile('<div id="'+menu+'">'+templateHtml+'</div>');
  var context = modules[menu].context();

  $placeholder.html(template(context));
}

$(window).blur(function(){
  ipcRenderer.send('tray-hide');
});

function buildMenu() {
  const menu = menuFactory(loadMenu, clientConfig, showLogin, syncStatus);

  menu.popup(remote.getCurrentWindow());
}

$('document').ready(function() {
  $('body').addClass(process.platform);
  compileTemplate();

  ipcRenderer.on('update-window', (event, menu) => {
    updateWindow(menu)
  });

  $('#item-installupdate').bind('click', function() {
    ipcRenderer.send('tray-hide');
    ipcRenderer.send('install-update');
  });

  $('#item-gotofolder').bind('click', function() {
    shell.openItem(clientConfig.get('balloonDir'));
    ipcRenderer.send('tray-hide');
  });

  $('#item-openinbrowser').bind('click', function() {
    shell.openExternal(clientConfig.get('blnUrl'));
    ipcRenderer.send('tray-hide');
  });

  $('#item-menu').bind('click', buildMenu);
});

ipcRenderer.on('unlink-account-result', (event, result) => {
  showLogin = result;
});

ipcRenderer.on('link-account-result', (event, result) => {
  showLogin = !result;
  clientConfig.initialize(false);
});

ipcRenderer.on('sync-started' , function() {
  syncStatus = true;
});

ipcRenderer.on('sync-resumed' , function() {
  syncStatus = true;
});

ipcRenderer.on('sync-paused' , function() {
  syncStatus = false;
});

ipcRenderer.on('tray-load-menu' , function(event, menu) {
  loadMenu(menu);
});

ipcRenderer.send('tray-window-loaded');
ipcRenderer.on('config', function(event, secret, secretType) {
  logger.info('got config', {category: 'tray-browser', secretType});

  clientConfig.initialize(false);
  var config = clientConfig.getAll();
  config[secretType] = secret;
  config.version = globalConfig.get('version');

  if(!clientConfig.get('loggedin') || !clientConfig.isActiveInstance()) {
    sync = undefined;
  } else {
    showLogin = false;
    sync = fullSyncFactory(config, logger);
  }

  updateWindow();
});

function compileTemplate() {
  var templateHtml = $('#template').html();
  var $placeholder = $('#content-wrapper');
  var template = handlebars.compile(templateHtml);
  var context = {};

  $placeholder.html(template(context));
}

function toggleInstallUpdate() {
  if(appState.get('updateAvailable')) {
    $('#item-installupdate').show();
  } else {
    $('#item-installupdate').hide();
  }
}

function updateWindow(menu='status') {
  logger.info('updateWindow', {category: 'tray-browser'});

  //TODO pixtron - do we still need this?
  $('#tray-main').html('');
  toggleInstallUpdate();
  loadMenu(menu);
}

function getOnLineState(callback) {
  var onLine = navigator.onLine;
  if(onLine === true) {
    if(clientConfig.get('apiUrl')) {
      var apiPingUrl = clientConfig.get('apiUrl');

      var reqOptions = {
        timeout: 2000,
        headers: {
          'X-Client': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname()].join('|'),
          'User-Agent': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname(), os.platform(), os.release()].join('|'),
        }
      };

      request.get(apiPingUrl, reqOptions, (err, result) => {
        callback(!err);
        if(err) {
          //if api is not reachable atm, check again in 5s
          window.setTimeout(updateOnLineState, 5000);
          logger.error('Failed to ping server. Retry in 5s.', {code: err.code, category: 'tray'});
        }
      });
    } else {
      callback(true);
    }
  } else {
    callback(false);
  }
}

function updateOnLineState() {
  getOnLineState(function(onLine) {
    ipcRenderer.send('tray-online-state-changed', onLine);
  });
}

getOnLineState(function(onLine) {
  ipcRenderer.send('tray-online-state-changed', onLine);

  window.addEventListener('online', updateOnLineState);
  window.addEventListener('offline', updateOnLineState);
});

ipcRenderer.on('network-offline', function() {
  updateOnLineState();
});

ipcRenderer.on('connected', function() {
  if(reconnectTimeout) clearTimeout(reconnectTimeout);
});

ipcRenderer.on('disconnected', function() {
  if(reconnectTimeout) clearTimeout(reconnectTimeout);

  reconnectTimeout = setTimeout(function() {
    ipcRenderer.send('try-to-reconnect');
  }, 5000);
});

}());
