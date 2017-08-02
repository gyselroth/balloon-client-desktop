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
  var $feedback = $('#feedback');

  $feedback.find('button').click(function(){
    var file = $feedback.find('input').is(':checked');
    var text = $feedback.find('textarea').val();
      
    $('#feedback-success').hide();
    $feedback.find('.error-message').hide();

    if(text === '') {
      $('#feedback-error-empty').show();
    } else {
      ipcRenderer.send('feedback-send', text, file);
    }
  })
    
  ipcRenderer.on('feedback-send-result', function(event, result){
    if(result === false) {
      $('#feedback-success').hide();
      $('#feedback-error-send').show();
    } else {
      $feedback.find('textarea').val('');
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
