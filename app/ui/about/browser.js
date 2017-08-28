(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const shell = electron.shell;
const handlebars = require('handlebars');
const uuid4 = require('uuid4');

const env = require('../../env.js');
const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');
const app = electron.remote.app;

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

$(document).ready(function() {
  compileTemplates();
  if(process.platform !== 'linux') {
    var $check = $('#about-version-check').click(function(){
      $('#about').find('.loader').show();
      $(this).hide();
      ipcRenderer.send('check-for-update');
    });
  
    var $install = $('#about-version-install').click(function(){
      ipcRenderer.send('install-update');
    });

    if(env.update && env.update.enable === true || !env.update || env.update.enable === undefined) {
      if(clientConfig.get('updateAvailable')) {
        $install.show();
        $check.hide();
      } else {
        $install.hide();
        $check.show();
      }
    }
  }

  $('#about').find('span').click(function(){
    shell.openExternal('https://gyselroth.com');
  });
});

ipcRenderer.on('error', () => {
  $('#about').find('#content > div').hide();
  $('#about-update-error').show();
});

ipcRenderer.on('update-downloaded', () => {
  $('#about').find('#content > div').hide();
  $('#about-version-install').show();
});

ipcRenderer.on('update-not-available', () => {
  $('#about').find('#content > div').hide();
  $('#about-update-not-available').show();
});

function compileTemplates() {
  var templateContentHtml = $('#template-content').html();
  var $placeholderContent = $('#contentWrapper');
  var templateContent = handlebars.compile(templateContentHtml);
  var context = {
    version: app.getVersion()
  };
  $placeholderContent.html(templateContent(context));
}
}());
