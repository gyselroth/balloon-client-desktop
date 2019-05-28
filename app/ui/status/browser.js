const path = require('path');

const { ipcRenderer, shell } = require('electron');
const moment = require('moment');

const clientConfig = require('../../lib/config.js');
const logTrayDb = require('../../lib/log-tray-db.js');
const tabNavigation = require('../tray/tab-navigation.js');
const MAX_DISPLAY = 50;
const prettyBytes = require('pretty-bytes');
const i18n = require('../../lib/i18n.js');
const fileIconMap = require('../../lib/file-icon-map.js');
const ta = require('../../lib/time-ago.js');

let showQuotaRetries = 0;

function showQuota(sync) {
  sync.blnApi.getQuotaUsage((err, data) => {
    if(err) {
      $('#status-quota-used').find('td').html(0);
      $('#status-quota-free').find('td').html(0);
      $('#status-quota-max').find('td').html(0);

      if(showQuotaRetries < 5) {
        showQuotaRetries ++;
        setTimeout(function() {
          showQuota(sync);
        }, 60000);
      }

      return;
    }

    showQuotaRetries = 0;
    var percent;

    if(data.hard_quota <=0) {
      percent = 0;
    } else {
      percent =  Math.round(data.used / data.hard_quota * 100, 0);
    }

    $('#status-quota-used').find('td').html(prettyBytes(data.used));
    $('#status-quota').find('.chart').addClass('chart-'+percent);

    if(data.hard_quota === -1) {
      $('#status-quota-left').find('td').html(i18n.__('status.quota.unlimited'));
      $('#status-quota-max').find('td').html(i18n.__('status.quota.unlimited'));
    } else {
      $('#status-quota-max').find('td').html(prettyBytes(data.hard_quota));
    }
  });
}

function getIcon(task) {
  if(task.subtype == 'error') {
    return 'gr-i-warning';
  }

  let ext = task.name.split('.').pop();

  if(fileIconMap[ext]) {
    return fileIconMap[ext];
  }

  return 'gr-i-file';
}

module.exports = function() {
  let taskHistory = {};
  let taskElements = {};
  let $transfer;
  let $error;
  let $syncStatus;

  ipcRenderer.on('transfer-task', function(event, task) {
    if(taskHistory[task.id]) {
      taskHistory[task.id].subtype = task.subtype;
    } else {
      taskHistory[task.id] = task;
      taskHistory[task.id].percent = 0;
    }

    taskHistory[task.id].datetime = new Date();
  });

  function init(sync) {
    if(sync) showQuota(sync);

    $transfer = $('#status-transfer');
    $error = $('#status-error');
    $syncStatus = $('#status-sync');
    tabNavigation('#status');

    if(clientConfig.get('instanceDir')) {
      logTrayDb.connect(path.join(clientConfig.get('instanceDir'), 'db', 'log-tray.db'), true);
    }

    for(task in taskHistory) {
      if(taskHistory[task].subtype !== 'queued') {
        $transfer.prepend(renderTask(taskHistory[task]));
      }
    }

    $transfer.off('click', 'li').on('click', 'li', function() {
      var title = $(this).attr('title');
      if(title == undefined) {
        return;
      }

      var nodePath = path.join(clientConfig.get('balloonDir'),path.dirname(title));
      shell.openItem(nodePath);
      ipcRenderer.send('tray-hide');
    });

    logTrayDb.getErrors((err, errors) => {
      if(errors) {
        if(errors.length > 0) {
          $error.empty();
        }

        let i;
        for(i=0; i < errors.length && i < MAX_DISPLAY; i++) {
          $error.append(renderError(errors[i]));
        }
      }
    });

    ipcRenderer.removeListener('sync-started', onSyncStarted);
    ipcRenderer.on('sync-started', onSyncStarted);

    ipcRenderer.removeListener('sync-resumed', onSyncResumed);
    ipcRenderer.on('sync-resumed', onSyncResumed);

    ipcRenderer.removeListener('sync-ended', onSyncEnded);
    ipcRenderer.on('sync-ended', onSyncEnded);

    ipcRenderer.removeListener('network-offline', onNetworkOffline);
    ipcRenderer.on('network-offline', onNetworkOffline);

    ipcRenderer.removeListener('unlink-account-result', onUnlinkAccountResult);
    ipcRenderer.on('unlink-account-result', onUnlinkAccountResult);

    ipcRenderer.removeListener('link-account-result', onUnlinkAccountResult);
    ipcRenderer.on('link-account-result', onUnlinkAccountResult);

    ipcRenderer.removeListener('sync-paused', onSyncPaused);
    ipcRenderer.on('sync-paused', onSyncPaused);

    ipcRenderer.removeListener('transfer-task', onTransferTask);
    ipcRenderer.on('transfer-task', onTransferTask);

    ipcRenderer.removeListener('transfer-progress', onTransferProgress);
    ipcRenderer.on('transfer-progress', onTransferProgress);

    ipcRenderer.removeListener('transfer-start', onTransferStart);
    ipcRenderer.on('transfer-start', onTransferStart);
  }

  function renderTask(task) {
    let percent = task.percent || 0;

    if(task.subtype === 'finished') {
      percent = 100;
    }

    let innerBarWidth = ['error', 'aborted'].indexOf(task.subtype) === -1 ? percent : 100;

    var dom = '<li title="'+path.join(task.parent, task.name)+'" id="'+task.id+'" class="task-'+task.subtype+'">'
      +'<div class="gr-icon '+getIcon(task)+'"></div>'
      +'<div class="task-name">'+task.name+'</div>';

      if(task.subtype == 'finished') {
        if(task.type == 'upload') {
          dom += '<div class="task-finish">'+i18n.__('status.activities.upload', [ta.format(task.datetime)])+'</div>';
        } else if(task.type == 'download') {
          dom += '<div class="task-finish">'+i18n.__('status.activities.download', [ta.format(task.datetime)])+'</div>';
        }
      } else if(task.subtype == 'error' || task.subtype == 'aborted') {
        if(task.type == 'upload') {
          dom += '<div class="task-finish">'+i18n.__('status.activities.upload_failed', [ta.format(task.datetime)])+'</div>';
        } else if(task.type == 'download') {
          dom += '<div class="task-finish">'+i18n.__('status.activities.download_failed', [ta.format(task.datetime)])+'</div>';
        }
      } else if(percent == 0) {
          dom += '<div class="task-queued">'+i18n.__('status.activities.waiting')+'</div>';
      } else {
        dom += '<div class="task-progress"><div class="task-progress-inner" style="width: '+innerBarWidth+'%;"></div></div>';
      }

    dom += '</li>';

    return $(dom);
  }

  function renderError(error) {
    return $(`<li id="${error.hash}" class="clearfix" >
      <div class="status-error-message">${error.message}</div>
      <div class="status-error-date">${ta.format(error.date)}</div>
    </li>`);
  }

  var onSyncStarted = function(event) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.start'));
    $syncStatus.find('div').show();
  }

  var onSyncResumed = function(event) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.default'));
    $syncStatus.find('div').hide();
  }

  var onSyncEnded = function(event) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.default'));
    $syncStatus.find('div').hide();
  }

  var onNetworkOffline = function(event) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.offline'));
    $syncStatus.find('div').hide();
  };

  var onUnlinkAccountResult = function(event, result) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.loggedout'));
    $syncStatus.find('div').hide();
    taskHistory = {};
    $transfer.find('li').not('.status-no-elements').remove();
    $error.find('li').not('.status-no-elements').remove();
  }

  var onUnlinkAccountResult = function(event, result) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.warmup'));
    $syncStatus.find('div').hide();
  }

  var onSyncPaused = function(event) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.pause'));
    $syncStatus.find('div').hide();
  }

  var onTransferTask = function(event, task) {
    $item = $transfer.find(`#${task.id}`);
    task.datetime = taskHistory[task.id].datetime || new Date();

    //Displaying all nodes in the queue will result in a freezes since the dom tree can get huge.
    if(task.subtype === 'queued') {
      return;
    }

    if($transfer.find('li').length > MAX_DISPLAY) {
      $transfer.find('li').not('.task-progress').not('.task-queued').not('.status-no-elements').last().remove();
    }

    if($item.length > 0) {
      $item.replaceWith(renderTask(task));
    } else {
      $transfer.prepend(renderTask(task));
    }
  }

  var onTransferProgress = function(event, task) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.transfer'));
    $syncStatus.find('div').show();

    if(taskHistory[task.id]) {
      taskHistory[task.id].percent = task.percent;
      $item = $transfer.find(`li#${task.id}`);
      if($item.length > 0) {
        $item.replaceWith(renderTask(taskHistory[task.id]));
      }
    }
  }

  var onTransferStart = function(event) {
    $syncStatus.find('span').html(i18n.__('tray.sync.status.tree'));
    $syncStatus.find('div').show();
  }

  return {
    init,
    context: function(){ return {}; },
  }
}
