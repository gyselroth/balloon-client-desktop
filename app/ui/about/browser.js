(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const uuid4 = require('uuid4');

const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');
const app = electron.remote.app;

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

$(document).ready(function() {
  compileTemplates();
  $('#about-version').click(function(){
    ipcRenderer.send('check-for-update');
  })
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
