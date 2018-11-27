const { ipcRenderer } = require('electron');

const globalConfig = require('../../lib/global-config.js');
const clientConfig = require('../../lib/config.js');
const autoLaunch = require('../../lib/auto-launch.js');
const tabNavigation = require('../tray/tab-navigation.js');

module.exports = function() {
  let taskHistory = {};

  ipcRenderer.on('transfer-task', function(event, task) {
    if(taskHistory[task.id]) {
      taskHistory[task.id].subtype = task.subtype;
    } else {
      taskHistory[task.id] = task;
      taskHistory[task.id].percent = 0;
    }
  });

  ipcRenderer.on('sync-started' , function() {
    taskHistory = {};
    $('#status-transfer').empty();
  });

  function init() {
    let $transfer = $('#status-transfer');
    tabNavigation('#status');
    let i;

    $transfer.empty();

    for(id in taskHistory) {
      $transfer.append(renderTask(taskHistory[id]));
    }

    ipcRenderer.on('transfer-task', function(event, task) {
      $item = $transfer.find(`li#${task.id}`);

      if($item.length > 0) {
        $item.replaceWith(renderTask(task));
      } else {
        $transfer.append(renderTask(task));
      }
    });

    ipcRenderer.on('transfer-progress', function(event, task) {
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

    return $(`<li id="${task.id}" class="task-${task.subtype}">
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
