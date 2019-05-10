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

  if(!clientConfig.get('blnUrl')) {
    let $server = $('#startup-view-server').find('.view-content').find('> div').show();

    try {
      let last = instance.getInstanceByName(instance.getLastActiveInstance());

      if(last && last.server) {
        $server.find('input').val(last.server);
      }
    } catch(error) {}
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

  var $loader = $('.window-loader').show();

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
  var apiPingUrl = blnUrl + '/api/v2';

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
      callback(!(err || body.name !== 'balloon'));
    } catch(error) {
      callback(false);
    }
  });
}

function welcome() {
  $('#startup-advanced').bind('click', function() {
    var $savedir = $('#startup-savedir');
    var $savedirLabel = $savedir.find('> div:first-child');

    $savedirLabel.html(clientConfig.get('balloonDir'));
    $savedir.bind('click', function() {
      ipcRenderer.send('balloonDirSelector-open');
    });

    $('#startup-adavanced-selective').bind('click', function() {
      ipcRenderer.send('selective-open');
    });

    ipcRenderer.on('balloonDirSelector-result', function (event, result) {
      if(result && result.newPath) {
        $savedirLabel.html(result.newPath);
      }
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
  if(env.auth && env.auth.credentials === null) {
    $('#startup-auth-credentials').hide();
  }

  var $loader = $('.window-loader');
  var $container = $('#startup-auth-oidc');
  $container.find('> img').remove();

  var $username = $('#startup-view-auth').find('input[name=username]');
  var $password = $('#startup-view-auth').find('input[name=password]');
  var $mfaCode = $('#startup-view-auth').find('input[name=mfaCode]');

  $username.show();
  $password.show();
  $mfaCode.hide();

  $username.val('');
  $password.val('');
  $mfaCode.val('');

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

  ipcRenderer.removeAllListeners('startup-auth-mfa-required');
  ipcRenderer.on('startup-auth-mfa-required', function(event) {
    $loader.hide();

    if(env.auth && ['basic', null].includes(env.auth.credentials)) {
      $('#startup-auth-error').find('> div').hide()
      $('#startup-auth-error-mfa-not-token').show();
    } else {
      $username.hide();
      $password.hide();
      $mfaCode.show();
    }
  });

  ipcRenderer.removeAllListeners('startup-auth-error');
  ipcRenderer.on('startup-auth-error', function (event, type) {
    $loader.hide();
    $('#startup-auth-error').find('> div').hide()
    $('#startup-auth-error-'+type).show();
  });

  $('#startup-auth-credentials').off('submit').on('submit', function(event) {
    event.preventDefault();

    $loader.show();
    var username = $username.val();
    var password = $password.val();
    var code = $mfaCode.val();
    ipcRenderer.send('startup-credentials-signin', username, password, code);
  });
}

function switchView(view) {
  $(document).ready(function(){
    $('.window-loader').hide();
    $(".view").hide();
    $("#startup-view-"+view).show()
     .find('input,textarea,select,button').filter(':visible:first').focus();

    if(view in window) {
      window[view]();
    }
  });
}
