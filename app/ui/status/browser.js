const { ipcRenderer } = require('electron');

const tabNavigation = require('../tray/tab-navigation.js');
const MAX_DISPLAY = 50;
const prettyBytes = require('pretty-bytes');
const i18n = require('../../lib/i18n.js');

function showQuota(sync) {
  /*if(refreshQuota === false) {
    $quota.hide();
    return;
  }*/

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

    if(data.hard_quota === 0) {
      $('#status-quota-free').find('td').html(i18n.__('status.quota.unlimited'));
      $('#status-quota-max').find('td').html(i18n.__('status.quota.unlimited'));
    } else {
      $('#status-quota-free').find('td').html(prettyBytes(data.available));
      $('#status-quota-max').find('td').html(prettyBytes(data.hard_quota));
    }
  });
}

module.exports = function() {
  let taskHistory = {};
  let taskElements = {};

  ipcRenderer.on('transfer-task', function(event, task) {
console.log(event, task);
    if(taskHistory[task.id]) {
      taskHistory[task.id].subtype = task.subtype;
    } else {
      taskHistory[task.id] = task;
      taskHistory[task.id].percent = 0;
    }
  });

  ipcRenderer.on('sync-started' , function() {
    //taskHistory = {};
    //$('#status-transfer').empty();
  });

  function init(sync) {
    showQuota(sync);

    let $transfer = $('#status-transfer');
    tabNavigation('#status');
    let i;

    $transfer.empty();

    for(id in taskHistory) {
      let element = renderTask(taskHistory[id]);
      taskElements[element] = element;
      $transfer.append(element);
    }

    ipcRenderer.on('transfer-task', function(event, task) {
      //$item = $transfer.find(`li#${task.id}`);

      if(taskElements[task.id]) {
        let $item = taskElements[task.id];
        $item.replaceWith(renderTask(task));
      } else {
        let $item = renderTask(task);
        taskElements[task.id] = $item;
        $transfer.append($item);
      }
    });

    ipcRenderer.on('transfer-progress', function(event, task) {
      if(taskHistory[task.id]) {
        taskHistory[task.id].percent = task.percent;
        let $item = taskElements[task.id];
        //$item = $transfer.find(`li#${task.id}`);

        if($item.length > 0) {
          let element = renderTask(taskHistory[task.id]);
          $item.replaceWith($item);

          //$item.replaceWith(renderTask(taskHistory[task.id]));
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

    return $(`<li id="${task.id}" class="task-${task.subtype}">
      <div class="gr-icon g-i-folder"></div>
      <div class="task-name">${task.name}</div>
      <div class="task-percent">${Math.round(percent)}%</div>
      <div class="task-progress"><div class="task-progress-inner" style="width: ${innerBarWidth}%;"></div></div>
    </li>`);
  }

  return {
    init,
    context: function(){ return {}; },
  }
}
