const { ipcRenderer } = require('electron');

const globalConfig = require('../../lib/global-config.js');
const clientConfig = require('../../lib/config.js');
const autoLaunch = require('../../lib/auto-launch.js');
const tabNavigation = require('../tray/tab-navigation.js');

module.exports = function() {
  function init() {
    var isLoggedIn = clientConfig.isActiveInstance() !== undefined;

    if(process.platform === 'linux') {
      $('#settings-allowPrerelease').hide();
    }

    if(isLoggedIn) {
      $('#settings-nav-user').show();
    } else {
      $('#settings-nav-user').hide();
    }

    tabNavigation('#settings');

    /** Auto launch **/
    const $autoLaunchCheck = $('#settings-autolaunch-check');
    $autoLaunchCheck.attr('checked', autoLaunch.getState());

    $autoLaunchCheck.bind('change', function(event) {
      this.disabled = true;
      autoLaunch.setState(this.checked).then((result) => {
        this.disabled = false;
      });
    });

    /** Allow prerelease **/
    const $allowPrereleaseCheck = $('#settings-allowPrerelease-check');
    $allowPrereleaseCheck.attr('checked', globalConfig.get('allowPrerelease'));

    $allowPrereleaseCheck.bind('change', function(event) {
      globalConfig.set('allowPrerelease', this.checked);
    });

    /** Auto report **/
    const $autoReportCheck = $('#settings-autoReport-check');

    $autoReportCheck.attr('checked', globalConfig.get('autoReport'));

    $autoReportCheck.bind('change', function(event) {
      globalConfig.set('autoReport', this.checked);
      ipcRenderer.send('settings-autoReport-changed', this.checked);
    });

    /** BalloonDir **/
    const $balloonDirBtn = $('#settings-balloonDir');
    const $balloonDirBtnLabel = $balloonDirBtn.find('> div:first-child');

    $balloonDirBtnLabel.html(clientConfig.get('balloonDir'));
    $balloonDirBtn.bind('click', function(event) {
      ipcRenderer.send('balloonDirSelector-open');
    });

    ipcRenderer.on('balloonDirSelector-result', function (event, result) {
      if(result && result.newPath) {
        $balloonDirBtnLabel.html(result.newPath);
      }
    });

    /** Selective **/
    const $selectiveBtn = $('#settings-selective-btn');

    $selectiveBtn.bind('click', function(event) {
      ipcRenderer.send('selective-open');
    });
  }

  return {
    init,
    context: function(){ return {}; },
  }
}
