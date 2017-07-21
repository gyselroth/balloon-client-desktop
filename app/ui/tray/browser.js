(function () {'use strict';

const {ipcRenderer, shell} = require('electron');
const handlebars = require('handlebars');
const request = require('request');

const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

$('document').ready(function() {
  $('body').addClass(process.platform);
  compileTemplate();
    
  ipcRenderer.on('show-quota' , function() {
    showQuota();
  });

  $('#item-gotofolder').bind('click', function() {
    shell.openItem(clientConfig.get('balloonDir'));
    ipcRenderer.send('tray-hide');
  });

  $('#item-openinbrowser').bind('click', function() {
    shell.openExternal(clientConfig.get('blnUrl'));
    ipcRenderer.send('tray-hide');
  });

  $('#item-quit').bind('click', function() {
    ipcRenderer.send('quit');
  });

  $('#item-settings').bind('click', function() {
    ipcRenderer.send('settings-open');
  });

  if(clientConfig.get('context') === 'development') {
    $('#development-menu').show();

    /** Sync **/
    var $runSync = $('#item-runsync');

    ipcRenderer.on('sync-started' , function() {
      $runSync.addClass('disabled');
    });

    ipcRenderer.on('sync-ended' , function() {
      $runSync.removeClass('disabled');
    });

    $runSync.bind('click', function() {
      ipcRenderer.send('sync-start');
      ipcRenderer.send('tray-hide');
    });


    /** Reset **/
    var $runReset = $('#item-reset');

    $runReset.bind('click', function() {
      ipcRenderer.send('dev-reset');
      ipcRenderer.send('tray-hide');
      $runReset.addClass('disabled');
      $runSync.addClass('disabled');
    });

    ipcRenderer.on('dev-reset-complete', (event, err) => {
      if(err) return console.error('ERROR, reset not successfull', err);

      $runReset.removeClass('disabled');
      $runSync.removeClass('disabled');

      return console.info('Reset complete', new Date());
    });
  } else {
    $('#production-menu').show();

    var $togglePauseSync = $('#item-sync-toggle');
    $togglePauseSync.bind('click', function() {
      ipcRenderer.send('sync-toggle-pause');
      $togglePauseSync.toggleClass('paused');
    });
  }
});

function showQuota() {
  const logger = require('../../lib/logger.js');
  const clientConfig = require('../../lib/config.js');
  const syncFactory = require('@gyselroth/balloon-node-sync');

  var sync = syncFactory(clientConfig.getAll(), logger);
  sync.blnApi.getQuotaUsage((err, data) => {
    var percent =  Math.round(data.used / data.hard_quota * 100, 0);

    var $quota = $('#quota');
    var $used = $quota.find('.used');
    $used.width(percent+'%');

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
  var $placeholder = $('#contentWrapper');
  var template = handlebars.compile(templateHtml);

  var context = {};

  $placeholder.html(template(context));
}

/*
Network change detection
*/
function getOnLineState(callback) {
  var onLine = navigator.onLine;
  if(onLine === true) {
    var apiPingUrl = clientConfig.get('apiUrl');
    request.get(apiPingUrl, {timeout: 2000}, (err, result) => {
      callback(!err);
      if(err) {
        //if api is not reachable atm, check again in 5s
        window.setTimeout(updateOnLineState, 5000);
      }
    });
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

}());
