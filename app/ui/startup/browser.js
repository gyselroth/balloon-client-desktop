//(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const request = require('request');

const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');
const env = require('../../env.js');
const app = electron.remote.app;

const logger = require('../../lib/logger.js');
const loggerFactory = require('../../lib/logger-factory.js');
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
  var $loader = $('.loader').show();
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

  if(!clientConfig.get('blnUrl')) {
    $('#startup-view-server').find('.view-content').find('> div').show();
  }

  $('#startup-server-continue').bind('click', verifyServer);
  $(document).bind('keypress', function(e){
    if(e.which === 13 &&  $('#startup-view-server').is(':visible')) {
      verifyServer();
    }
  });

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
    return ipcRenderer.send('startup-server-continue');
  }

  var $blnUrlField = $('#blnUrl');
  var $blnUrlInvalidMessage = $('#blnUrl-error-invalid');
  var $blnUrlNotreachableMessage = $('#blnUrl-error-notreachable');
  var blnUrl = $blnUrlField.val();
  $blnUrlInvalidMessage.hide();
  $blnUrlNotreachableMessage.hide();

  if(/^https?:\/\//.test(blnUrl) === false) {
    blnUrl = 'https://' + blnUrl;
  }

  var $loader = $('#startup-view-server').find('.view-content').find('.loader').show();

  pingApiServer(blnUrl, (result) => {
    $loader.hide();

    if(result === false) {
      $blnUrlNotreachableMessage.show();
    } else {
      ipcRenderer.send('startup-server-continue', blnUrl);
    }
  });
}

function pingApiServer(blnUrl, callback) {
  var apiPingUrl = blnUrl + (env.apiPath || '/api/v1');

  request.get(apiPingUrl, {timeout: 2000}, (err, result) => {
    callback(!(err || result.statusCode !== 401));
  });
}

function welcome() {
  $('#startup-advanced').bind('click', function() {
    var $savedir = $('#startup-savedir');
    var $savedirLabel = $savedir.find('> div:first-child');

    $savedirLabel.html(clientConfig.get('balloonDir'));
    $savedir.bind('click', function() {
      ipcRenderer.send('startup-change-dir');
    });

    $('#startup-adavanced-selective').bind('click', function() {
      ipcRenderer.send('selective-open');
    });

    ipcRenderer.on('startup-change-dir', function (event, path) {
        $savedirLabel.html(path);
    });

    $('#startup-logo').hide();
    switchView('advanced');
  });
}

function advanced() {
  if(env.balloonDir) {
    $('#startup-advanced-saveDir').hide();
  }
}

function auth() {
  if(env.auth && env.auth.basic === false) {
    $('#startup-auth-basic').hide();
  }

  var $container = $('#startup-auth-oidc');
  $container.find('> img').remove();

  if(env.auth && env.auth.oidc) {
    var i=0;
    $(env.auth.oidc).each(function(e, idp){
      var img = '<img alt="'+i+'" src="data:image/png;base64,'+idp.imgBase64+'"/>';
      $container.append(img);
      ++i;
    });
  }

  $container.on('click', 'img', function(){
    ipcRenderer.send('auth-oidc-signin', $(this).attr('alt'));
  });

  ipcRenderer.on('startup-auth-error', function (event, type) {
    $('#startup-auth-error').find('> div').hide()
    $('#startup-auth-error-'+type).show();
  });

  function basicAuth() {
    var username = $('#startup-view-auth').find('input[name=username]').val();
    var password = $('#startup-view-auth').find('input[name=password]').val();
    ipcRenderer.send('startup-basic-auth', username, password);
  }

  $(document).bind('keypress', function(e){
    if($(e.target).attr('id') === 'startup-auth-continue') {
      return;
    }

    if(e.which === 13 && $('#startup-view-auth').is(':visible')) {
      basicAuth(e);
    }
  });

  $('#startup-auth-continue').bind('click', basicAuth);
}

function switchView(view) {
  $(document).ready(function(){
    $(".view").hide();
    $("#startup-view-"+view).show()
     .find('input,textarea,select,button').filter(':visible:first').focus();

    if(view in window) {
      window[view]();
    }
  });
}
