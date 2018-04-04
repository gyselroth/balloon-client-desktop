(function() {'use strict';

const {ipcRenderer, shell, remote} = require('electron');
const handlebars = require('handlebars');
const request = require('request');

const {fullSyncFactory} = require('@gyselroth/balloon-node-sync');

const i18n = require('../../lib/i18n.js');
const instance = require('../../lib/instance.js');
const clientConfig = require('../../lib/config.js');
const appState = require('../../lib/state.js');

const modules = {
  settings: require('../settings/browser.js')(),
  feedback: require('../feedback/browser.js')(),
  about: require('../about/browser.js')(),
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
var showReset     = true;
var showSync      = true;
var showLogin     = true;
var refreshQuota  = false;

function loadMenu(menu) {
  $('#tray-main-template').load('../'+menu+'/index.html', function() {
    $('#tray-quota').hide();
    $('#tray-main').removeClass('tray-main-splash');
    compileMenuTemplate(menu);
    modules[menu].init();
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
  var label;
  const {Menu, MenuItem} = remote
  const menu = new Menu()

  if(showLogin === false && clientConfig.get('username')) {
    menu.append(new MenuItem({label: clientConfig.get('username'), enabled: false}))
  }

  if(showLogin === true) {
    label = i18n.__('tray.menu.link');
    menu.append(new MenuItem({label: label, click: function(){
      ipcRenderer.send('link-account');
      ipcRenderer.send('tray-hide');
    }}))
  } else {
    label = i18n.__('tray.menu.unlink');
    menu.append(new MenuItem({label: label, click: function(){
      ipcRenderer.send('unlink-account');
      ipcRenderer.send('tray-hide');
    }}))
  }

  menu.append(new MenuItem({type: 'separator', enabled: false}))

  if(clientConfig.get('context') === 'development') {
    if(showSync === true) {
      label = i18n.__('tray.menu.startSync');
      menu.append(new MenuItem({label: label, click:function(){
        ipcRenderer.send('sync-start');
        ipcRenderer.send('tray-hide');
      }}))
    }

    if(showReset === true) {
      label = i18n.__('tray.menu.resetSync');
      menu.append(new MenuItem({label: label, click:function(){
        showReset = false;
        showSync = false;
        ipcRenderer.send('dev-reset');
        ipcRenderer.send('tray-hide');
      }}))
    }
  } else if(clientConfig.get('loggedin') === true) {
    if(syncStatus === true) {
      label = i18n.__('tray.menu.pauseSync');
    } else {
      label = i18n.__('tray.menu.continueSync');
    }
    menu.append(new MenuItem({label: label, click:function(){
      ipcRenderer.send('sync-toggle-pause');
      ipcRenderer.send('tray-hide');
    }}))
  }

  label = i18n.__('tray.menu.settings');
  menu.append(new MenuItem({label: label, click: function(){
    loadMenu('settings');
  }}))

  label = i18n.__('tray.menu.feedback');
  menu.append(new MenuItem({label: label, click: function(){
    loadMenu('feedback');
  }}))

  label = i18n.__('tray.menu.about');
  menu.append(new MenuItem({label: label, click: function(){
    loadMenu('about');
  }}))

  label = i18n.__('tray.menu.close');
  menu.append(new MenuItem({label: label, click: function(){
    ipcRenderer.send('quit');
  }}))

  menu.popup(remote.getCurrentWindow());
}

$('document').ready(function() {
  $('body').addClass(process.platform);
  compileTemplate();

  ipcRenderer.on('update-window', updateWindow);

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
  if(result) {
    $('#quota').find('.used').width(0);
    $('#quota').find('.quota-text').html('');
  }
});

ipcRenderer.on('link-account-result', (event, result) => {
  showLogin = !result;
  clientConfig.initialize(false);
});

ipcRenderer.on('sync-started' , function() {
  syncStatus = true;
  showSync = false;
});

ipcRenderer.on('sync-ended' , function() {
  showSync = true;
});

ipcRenderer.on('sync-paused' , function() {
  syncStatus = false;
});

ipcRenderer.on('dev-reset-complete', (event, err) => {
  if(err) return console.error('ERROR, reset not successfull', err);
  showReset = true;
  showSync = true;
  return console.info('Reset complete', new Date());
});

ipcRenderer.send('tray-window-loaded');
ipcRenderer.on('config', function(event, secret, secretType) {
  clientConfig.initialize(false);
  var config = clientConfig.getAll();
  config[secretType] = secret;

  if(!clientConfig.get('loggedin') || !clientConfig.isActiveInstance()) {
    refreshQuota = false;
    sync = undefined;
  } else {
    refreshQuota = true;
    showLogin = false;
    sync = fullSyncFactory(config, logger);
  }

  updateWindow();
});

function showQuota() {
  var $quota = $('#quota');

  if(refreshQuota === false) {
    $quota.hide();
    return;
  }

  sync.blnApi.getQuotaUsage((err, data) => {
    if(err) {
      $('#quota').find('.used').width(0);
      $('#quota').find('.quota-text').html('');
      $quota.hide();

      return;
    }

    var percent =  Math.round(data.used / data.hard_quota * 100, 0);
    var $used = $quota.find('.used');
    $used.width(percent+'%');
    $quota.show();

    if(percent >= 90) {
      $used.addClass('quota-high');
    } else {
      $used.removeClass('quota-high');
    }

    $quota.find('.quota-text').html('('+getReadableFileSizeString(data.available)+' left)');
  });
}

function getReadableFileSizeString(bytes) {
  if(bytes === null) {
    return '0B';
  }

  if(bytes < 1024) {
    return bytes+'B';
  }

  var i = -1;
  var units = ['kB', 'MB', 'GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
  do {
    bytes = bytes / 1024;
    i++;
  } while (bytes >= 1024);

  return Math.max(bytes, 0.1).toFixed(1) + ' ' + units[i];
}

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

function updateWindow() {
  $('#tray-quota').show();
  $('#tray-main').addClass('tray-main-splash').html('');
  showQuota();
  toggleInstallUpdate();
}

/*
Network change detection
*/
function getOnLineState(callback) {
  var onLine = navigator.onLine;
  if(onLine === true) {
    if(clientConfig.get('apiUrl')) {
      var apiPingUrl = clientConfig.get('apiUrl');
      request.get(apiPingUrl, {timeout: 2000}, (err, result) => {
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

}());
