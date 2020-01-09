const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const clientConfig = require('../../lib/config.js');
const logger = require('../../lib/logger.js');
const loggerFactory = require('../../lib/logger-factory.js');
var standardLogger = new loggerFactory(clientConfig.getAll());
logger.setLogger(standardLogger);

const app = electron.remote.app;

module.exports = function() {
  function init() {
    var $feedback = $('#feedback');
    var $file = $feedback.find('input[name="file"]');
    var $text = $feedback.find('textarea');
    var $loader = $feedback.find('.loader');
    var $submit = $feedback.find('button#feedback-send');
    var $feedbackErrorEmpty = $('#feedback-error-empty');

    var fileVal = sessionStorage.getItem('feedback.file') !== 'false';
    var textVal = sessionStorage.getItem('feedback.text') || '';

    $text.val(textVal);
    $file.prop('checked', fileVal);

    $file.off('change').on('change', function(event) {
      sessionStorage.setItem('feedback.file', $file.is(':checked'));
    });

    $text.off('keyup').on('keyup', function(event) {
      var content = $text.val();

      if(content.length > 0 && $feedbackErrorEmpty.is(':visible')) {
        $feedbackErrorEmpty.hide();
        $submit.prop('disabled', false);
      } else if(content.length === 0) {
        $feedbackErrorEmpty.show();
        $submit.prop('disabled', true);
      }

      sessionStorage.setItem('feedback.text', content);
    });

    $submit.click(function(){
      var file = $file.is(':checked');
      var text = $text.val();

      $submit.prop('disabled', true);

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
      $submit.prop('disabled', false);
      $loader.hide();

      if(result === false) {
        $('#feedback-success').hide();
        $('#feedback-error-send').show();
      } else {
        $('#feedback-success').show();
        $feedback.find('.error-message').hide();
        sessionStorage.removeItem('feedback.file');
        sessionStorage.removeItem('feedback.text');
      }
    });
  }

  return {
    init,
    context: function(){return {};}
  }
}
