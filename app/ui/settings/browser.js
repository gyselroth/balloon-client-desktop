(function () {'use strict';

const { ipcRenderer } = require('electron');
const handlebars = require('handlebars');

const globalConfig = require('../../lib/global-config.js');
const autoLaunch = require('../../lib/auto-launch.js');

const i18n = require('../../lib/i18n.js');

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

$(document).ready(function() {
  $('html').addClass(process.platform);

  compileTemplates();

  const $navigationItems = $('#settings-navigation li a');
  const $tabContents = $('.tab-content');

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

  const $selectiveBtn = $('#settings-selective-btn');

  $selectiveBtn.bind('click', function(event) {
    ipcRenderer.send('selective-open');
  });



  $('#settings-close').bind('click', function(event) {
    event.preventDefault();
    ipcRenderer.send('settings-close');
  });
});

function compileTemplates() {
  var templateContentHtml = $('#template-content').html();
  var $placeholderContent = $('#contentWrapper');
  var templateContent = handlebars.compile(templateContentHtml);

  var context = {};

  $placeholderContent.html(templateContent(context));
}
}());
