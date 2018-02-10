(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const uuid4 = require('uuid4');

const clientConfig = require('../../lib/config.js');
const appState = require('../../lib/state.js');

const i18n = require('../../lib/i18n.js');
const app = electron.remote.app;

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

$(document).ready(function() {
  $('html').addClass(process.platform);

  compileTemplates();

  ipcRenderer.on('update-window', updateWindow);

  var $checkForUpdate = $('#check-for-update');
  var $installUpdate = $('#install-update');
  var $errorReportErrorMessage = $('#error-report-failure');
  var $errorReport = $('#settings-report');

  $checkForUpdate.bind('click', function() {
    ipcRenderer.send('check-for-update');
  });

  $installUpdate.bind('click', function() {
    ipcRenderer.send('install-update');
  });


  $errorReport.bind('click', function() {
    if($errorReport.is(':visible')) {
      $errorReport.hide();
      $errorReportErrorMessage.hide();
      ipcRenderer.send('settings-send-error-report');

      ipcRenderer.once('settings-send-error-report-result', (event, result) => {
        $errorReport.show();

        if(result === false) {
          $errorReportErrorMessage.show();
        }
      });
    }
  });

  var $usernameValue = $('#value-username');
  var $logout        = $('#settings-account-logout');
  var $login         = $('#settings-account-login');

  function updateLoginState() {
    if(clientConfig.get('loggedin') === true) {
      $logout.show();
      $login.hide();
      $usernameValue.html(clientConfig.get('username'));
    } else {
      $logout.hide();
      $login.show();
      $usernameValue.html(i18n.__('settings.account.loggedout'));
    }
  }

  function toggleInstallUpdate() {
    $installUpdate.toggle(appState.get('updateAvailable'));
    $checkForUpdate.toggle(!appState.get('updateAvailable'));
  }

  function updateWindow() {
    toggleInstallUpdate();
    updateLoginState();
  }

  $logout.bind('click', function() {
    if($logout.is(':visible')) {
      $logout.hide();
      ipcRenderer.send('settings-logout-requested');

      ipcRenderer.once('settings-logout-requested-result', (event, result) => {
        $logout.show();
        updateLoginState();
      });
    }
  });

  $login.bind('click', function() {
    var id = uuid4();
    ipcRenderer.send('settings-login-requested', id);

    ipcRenderer.once('settings-login-requested-result-'+id, (event, result) => {
      if(result === true) updateLoginState();
    });
  });

  updateWindow();
});

function compileTemplates() {
  var templateContentHtml = $('#template-content').html();
  var $placeholderContent = $('#contentWrapper');
  var templateContent = handlebars.compile(templateContentHtml);

  var context = {
    version: app.getVersion(),
    balloonDir: clientConfig.get('balloonDir')
  };

  $placeholderContent.html(templateContent(context));
}
}());
