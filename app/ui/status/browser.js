const path = require('path');

const { ipcRenderer } = require('electron');
const moment = require('moment');

const clientConfig = require('../../lib/config.js');
const logTrayDb = require('../../lib/log-tray-db.js');
const tabNavigation = require('../tray/tab-navigation.js');
const MAX_DISPLAY = 50;
const prettyBytes = require('pretty-bytes');
const i18n = require('../../lib/i18n.js');
const fileIconMap = require('../../lib/file-icon-map.js');
const ta = require('time-ago');

function showQuota(sync) {
  sync.blnApi.getQuotaUsage((err, data) => {
    if(err) {
      $('#status-quota-used').find('td').html(0);
      $('#status-quota-free').find('td').html(0);
      $('#status-quota-max').find('td').html(0);

      if(err.code === 'E_BLN_API_REQUEST_UNAUTHORIZED') {
        ipcRenderer.send('sync-error', err);
      }

      return;
    }

    var percent;

    if(data.hard_quota <=0) {
      percent = 0;
    } else {
      percent =  Math.round(data.used / data.hard_quota * 100, 0);
    }

    $('#status-quota-used').find('td').html(prettyBytes(data.used));
    $('#status-quota').find('.chart').addClass('chart-'+percent);

    if(data.hard_quota === 0) {
      $('#status-quota-free').find('td').html(i18n.__('status.quota.unlimited'));
      $('#status-quota-max').find('td').html(i18n.__('status.quota.unlimited'));
    } else {
      $('#status-quota-free').find('td').html(prettyBytes(data.available));
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

    let $transfer = $('#status-transfer');
    let $error = $('#status-error');
    tabNavigation('#status');

    if(clientConfig.get('instanceDir')) {
      logTrayDb.connect(path.join(clientConfig.get('instanceDir'), 'db', 'log-tray.db'), true);
    }
    let i;

    for(id in taskHistory) {
      $transfer.append(renderTask(taskHistory[id]));
    }

    logTrayDb.getErrors((err, errors) => {
      if(errors) {
        if(errors.length > 0) {
          $error.empty();
        }

        for(i=0; i < errors.length; i++) {
          $error.append(renderError(errors[i]));
        }
      }
    });

    ipcRenderer.on('sync-started', function(event) {
      $('#status-sync').find('span').html(i18n.__('tray.sync.status.start'));
      $('#status-sync').find('div').show();
    });

    ipcRenderer.on('sync-ended', function(event) {
      $('#status-sync').find('span').html(i18n.__('tray.sync.status.default'));
      $('#status-sync').find('div').hide();
    });

    ipcRenderer.on('transfer-task', function(event, task) {
      $item = $transfer.find(`#${task.id}`);

      task.datetime = taskHistory[task.id].datetime || new Date();

      if($item.length > 0) {
        $item.replaceWith(renderTask(task));
      } else {
        $transfer.append(renderTask(task));
      }
    });

    ipcRenderer.on('transfer-progress', function(event, task) {
      $('#status-sync').find('span').html(i18n.__('tray.sync.status.transfer'));
      $('#status-sync').find('div').show();

      if(taskHistory[task.id]) {
        taskHistory[task.id].percent = task.percent;
        $item = $transfer.find(`li#${task.id}`);
        if($item.length > 0) {
          $item.replaceWith(renderTask(taskHistory[task.id]));
        }
      }
    });
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
          dom += '<div class="task-finish">'+i18n.__('status.activities.upload', [ta.ago(task.datetime, true)])+'</div>';
        } else if(task.type == 'download') {
          dom += '<div class="task-finish">'+i18n.__('status.activities.download', [ta.ago(task.datetime, true)])+'</div>';
        }
      } else if(task.subtype == 'error') {
        if(task.type == 'upload') {
          dom += '<div class="task-finish">'+i18n.__('status.activities.upload_failed', [ta.ago(task.datetime, true)])+'</div>';
        } else if(task.type == 'download') {
          dom += '<div class="task-finish">'+i18n.__('status.activities.download_failed', [ta.ago(task.datetime, true)])+'</div>';
        }
      } else if(percent == 0) {
          dom += '<div class="task-finish">'+i18n.__('status.activities.waiting')+'</div>';
      } else {
        dom += '<div class="task-progress"><div class="task-progress-inner" style="width: '+innerBarWidth+'%;"></div></div>';
      }

    dom += '</li>';

    return $(dom);
  }

  function renderError(error) {
    return $(`<li id="${error.hash}" class="clearfix" >
      <div class="status-error-message">${error.message}</div>
      <div class="status-error-date">${moment(error.date).format('DD.MM.YYYY HH:mm:ss')}</div>
    </li>`);
  }

  return {
    init,
    context: function(){ return {}; },
  }
}
