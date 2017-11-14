(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const uuid4 = require('uuid4');

const clientConfig = require('../../lib/config.js');

const logger = require('../../lib/logger.js');
const loggerFactory = require('../../lib/logger-factory.js');
var standardLogger = new loggerFactory(clientConfig.getAll());
logger.setLogger(standardLogger);

const i18n = require('../../lib/i18n.js');
const app = electron.remote.app;

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

$(document).ready(function() {
  compileTemplates();
  var $feedback = $('#feedback');

  $feedback.find('button').click(function(){
    var file = $feedback.find('input').is(':checked');
    var text = $feedback.find('textarea').val();
    var $loader = $feedback.find('.loader');

    if($loader.is(':visible')) {
      return;
    }

    $('#feedback-success').hide();
    $feedback.find('.error-message').hide();

    if(text === '') {
      $('#feedback-error-empty').show();
    } else {
      $loader.show();
      ipcRenderer.send('feedback-send', text, file);
    }
  })

  ipcRenderer.on('feedback-send-result', function(event, result){
    if(result === false) {
      $('#feedback-success').hide();
      $('#feedback-error-send').show();
    } else {
      $feedback.find('.loader').hide();
      $('#feedback-form').hide();
      $('#feedback-send').hide();
      $('#feedback-success').show();
      $feedback.find('.error-message').hide();
    }
  });
});

function compileTemplates() {
  var templateContentHtml = $('#template-content').html();
  var $placeholderContent = $('#contentWrapper');
  var templateContent = handlebars.compile(templateContentHtml);
  $placeholderContent.html(templateContent());
}
}());
