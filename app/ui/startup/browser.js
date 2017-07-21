(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const uuid4 = require('uuid4');
const request = require('request');

const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');
const env = require('../../env.js');
const app = electron.remote.app;


handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});


$("document").ready(function() {
  $("html").addClass(process.platform);
  compileTemplates();

  var $blnUrlOfflineMessage = $('#blnUrl-error-offline');
  var $blnUrlConfig = $('#blnUrl-config');

  function updateOnLineState(onLine) {
    if(onLine === false) {
      $blnUrlConfig.hide();
      $blnUrlOfflineMessage.show();
    } else {
      $blnUrlConfig.show();
      $blnUrlOfflineMessage.hide();
    }
  }

  updateOnLineState(navigator.onLine);
  window.addEventListener('online', updateOnLineState);
  window.addEventListener('offline', updateOnLineState);

  $('#startup-server-continue').bind('click', verifyServer);
  $(document).bind('keypress', function(e){
    if(e.which === 13) {
      verifyServer();
    }
  });

  $('.startup-open-folder').bind('click', function() {
    ipcRenderer.send('startup-open-folder');
  });

  $('#startup-advanced').bind('click', function() {
    var $savedir = $('#startup-savedir');
    var $savedirLabel = $savedir.find('> div:first-child');

    $savedirLabel.html(clientConfig.get('balloonDir'));
    $savedir.bind('click', function() {
      ipcRenderer.send('startup-change-dir');
    });

    $('#startup-adavanced-selective').bind('click', function() {
      ipcRenderer.send('startup-selective-sync');
    });

    ipcRenderer.on('startup-change-dir', function (event, path) {
        $savedirLabel.html(path);
    });

    $('#startup-logo').hide();
    switchView('advanced');
  });
});

function compileTemplates() {
  var templateContentHtml = $('#template-content').html();
  var $placeholderContent = $('#contentWrapper');
  var templateContent = handlebars.compile(templateContentHtml);

  var context = {};

  $placeholderContent.html(templateContent(context));
}

function verifyServer() {
  var $blnUrlField = $('#blnUrl');
  var $blnUrlInvalidMessage = $('#blnUrl-error-invalid');
  var $blnUrlNotreachableMessage = $('#blnUrl-error-notreachable');
  var blnUrl = $blnUrlField.val();
  $blnUrlInvalidMessage.hide();
  $blnUrlNotreachableMessage.hide();

  if(blnUrl && /^(https?:\/\/)?[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+/.test(blnUrl)) {
    if(/^https:\/\/?/.test(blnUrl) === false) {
      blnUrl = 'https://' + blnUrl;
    }

    var apiPingUrl = blnUrl + clientConfig.get('apiPath');

    request.get(apiPingUrl, {timeout: 2000}, (err, result) => {
      if(err || result.statusCode !== 401) {
        $blnUrlNotreachableMessage.show();
      } else {
        ipcRenderer.send('startup-server-continue', blnUrl);
      }
    });
  } else {
    $blnUrlInvalidMessage.show();
  }
}

function switchView(view) {
  $("#startup-view").find("> div").hide();
  $("#startup-view-"+view).show();
}
}());

function switchView(view) {
  $(document).ready(function(){
    $("#startup-view").find("> div").hide();
    $("#startup-view-"+view).show();
  });
}
