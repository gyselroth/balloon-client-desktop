const { ipcRenderer } = require('electron');

const globalConfig = require('../../lib/global-config.js');
const clientConfig = require('../../lib/config.js');
const autoLaunch = require('../../lib/auto-launch.js');

module.exports = function() {
  function init() {
    var $navigationItems = $('#settings-navigation li a');
    var $tabContents = $('.tab-content');

    var isLoggedIn = clientConfig.isActiveInstance() !== undefined;

    if(process.platform === 'linux') {
      $('#settings-allowPrerelease').hide();
    }

    if(isLoggedIn) {
      $('#settings-nav-user').show();
    } else {
      $('#settings-nav-user').hide();
    }

    navigateTo('settings-global');

    $navigationItems.bind('click', function(event) {
      event.preventDefault();
      navigateTo($(this).attr('href').substr(1));
    });

    function navigateTo(tab) {
      $navigationItems.parent('li').removeClass('tab-navigation-active');
      $tabContents.removeClass('tab-active');

      $navigationItems.addBack().find('[href="#' + tab + '"]').parent('li').addClass('tab-navigation-active');
      $tabContents.addBack().find('#' + tab).addClass('tab-active');
    }

    const $autoLaunchCheck = $('#settings-autolaunch-check');
    $autoLaunchCheck.attr('checked', autoLaunch.getState());

    $autoLaunchCheck.bind('change', function(event) {
      this.disabled = true;
      autoLaunch.setState(this.checked).then((result) => {
        this.disabled = false;
      });
    });

    const $allowPrereleaseCheck = $('#settings-allowPrerelease-check');
    $allowPrereleaseCheck.attr('checked', globalConfig.get('allowPrerelease'));

    $allowPrereleaseCheck.bind('change', function(event) {
      globalConfig.set('allowPrerelease', this.checked);
    });

    const $autoReportCheck = $('#settings-autoReport-check');

    $autoReportCheck.attr('checked', globalConfig.get('autoReport'));

    $autoReportCheck.bind('change', function(event) {
      globalConfig.set('autoReport', this.checked);
      ipcRenderer.send('settings-autoReport-changed', this.checked);
    });

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
