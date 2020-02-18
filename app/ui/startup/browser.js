//(function () {'use strict';

const os = require('os');

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const request = require('request');

const clientConfig = require('../../lib/config.js');
const instance = require('../../lib/instance.js');

const i18n = require('../../lib/i18n.js');
const env = require('../../env.js');
const app = electron.remote.app;

const logger = require('../../lib/logger.js');
const loggerFactory = require('../../lib/logger-factory.js');
const globalConfig = require('../../lib/global-config.js');

var standardLogger = new loggerFactory(clientConfig.getAll());
logger.setLogger(standardLogger);


handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});


$(document).ready(function() {
  var $html = $("html");

  $html.addClass(process.platform);
  compileTemplates();
  var $loader = $('.window-loader').show();
  var $offline = $('#client-offline');
  var $content = $('.view-content');

  function updateOnLineState() {
    if(navigator.onLine === false) {
      $loader.hide();
      $content.hide();
      $offline.show();
    } else {
      checkIfHostReachable(clientConfig.get('blnUrl'), (result) => {
        $loader.hide();
        if(result === false) {
          $offline.show();
          $content.hide();
          window.setTimeout(updateOnLineState, 5000);
        } else {
          $offline.hide();
          $content.show();
        }
      });
    }
  }

  updateOnLineState();
  window.addEventListener('online', updateOnLineState);
  window.addEventListener('offline', updateOnLineState);

  $('.startup-open-folder').bind('click', function() {
    ipcRenderer.send('startup-open-folder');
  });
});

function checkIfHostReachable(blnUrl, callback) {
  if(blnUrl) {
    pingApiServer(blnUrl, callback);
  } else {
    callback(true);
  }
}

function compileTemplates() {
  var templateContentHtml = $('#template-content').html();
  var $placeholderContent = $('#content-wrapper');
  var templateContent = handlebars.compile(templateContentHtml);

  var context = {};

  $placeholderContent.html(templateContent(context));
}

function verifyServer() {
  if(clientConfig.get('blnUrl')) {
    $(document).unbind('keypress');
    return ipcRenderer.send('startup-server-continue');
  }

  var $blnUrlField = $('#blnUrl');
  var $blnUrlInvalidMessage = $('#blnUrl-error-invalid');
  var $blnUrlNotreachableMessage = $('#blnUrl-error-notreachable');
  var blnUrl = $blnUrlField.val().replace(/\/+$/, '').trim();
  $blnUrlInvalidMessage.hide();
  $blnUrlNotreachableMessage.hide();

  if(/^https?:\/\//.test(blnUrl) === false) {
    blnUrl = 'https://' + blnUrl;
  }

  var $loader = $('.window-loader').show();

  pingApiServer(blnUrl, (result) => {
    $loader.hide();

    if(result === false) {
      $blnUrlNotreachableMessage.show();
    } else {
      $(document).unbind('keypress');
      ipcRenderer.send('startup-server-continue', blnUrl);
    }
  });
}

function pingApiServer(blnUrl, callback) {
  var apiPingUrl = blnUrl + '/api/v3';

  var reqOptions = {
    timeout: 2000,
    headers: {
      'X-Client': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname()].join('|'),
      'User-Agent': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname(), os.platform(), os.release()].join('|'),
    }
  };

  request.get(apiPingUrl, reqOptions, (err, result) => {
    try {
      var body = JSON.parse(result.body);
      console.log(body);
      callback(!(err || body.name !== 'balloon'));
    } catch(error) {
      console.log(error);
      callback(false);
    }
  });
}

function serverView() {
  if(!clientConfig.get('blnUrl')) {
    let $server = $('#startup-view-server').find('.view-content').find('> div').show();

    try {
      let last = instance.getInstanceByName(instance.getLastActiveInstance());

      if(last && last.server) {
        $server.find('input').val(last.server);
      }
    } catch(error) {}
  } else {
    return ipcRenderer.send('startup-server-continue');
  }

  $('#startup-server-continue').bind('click', verifyServer);
  $(document).bind('keypress', function(e){
    if(e.which === 13 && $('#startup-view-server').is(':visible')) {
      verifyServer();
    }
  });
}

function welcomeView() {
  $('#startup-advanced').bind('click', function() {
    var $savedir = $('#startup-savedir');
    var $savedirLabel = $savedir.find('> div:first-child');

    $savedirLabel.html(clientConfig.get('balloonDir'));
    $savedir.bind('click', function() {
      ipcRenderer.send('balloonDirSelector-open');
    });

    ipcRenderer.on('balloonDirSelector-result', function (event, result) {
      if(result && result.newPath) {
        $savedirLabel.html(result.newPath);
      }
    });

    switchView('advanced');
  });
}

function selectiveView() {
  $('#startup-selective-edit').off('click').bind('click', function() {
    ipcRenderer.send('selective-open');
  });

  $('#startup-selective-continue').off('click').bind('click', function() {
    switchView('welcome');
  });
}

function advancedView() {
  if(env.balloonDir) {
    $('#startup-advanced-saveDir').hide();
  }
}

function clientInitiatedLogoutWarningView() {
  $('#startup-clientInitiatedLogoutWarning-continue').off('click').on('click', function(event) {
    event.preventDefault();
    ipcRenderer.send('startup-clientInitiatedLogoutWarning-continue');
  });
}

function switchView(view) {
  $(document).ready(function(){
    $('.window-loader').hide();
    $(".view").hide();
    $("#startup-view-"+view).show()
     .find('input,textarea,select,button').filter(':visible:first').focus();

    if(window[view+'View']) {
      window[view+'View']();
    }
  });
}
