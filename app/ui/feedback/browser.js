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

    var fileVal = sessionStorage.getItem('feedback.file') !== 'false';
    var textVal = sessionStorage.getItem('feedback.text') || '';

    $text.val(textVal);
    $file.prop('checked', fileVal);

    $file.off('change').on('change', function(event) {
      sessionStorage.setItem('feedback.file', $file.is(':checked'));
    });

    $text.off('change').on('change', function(event) {
      sessionStorage.setItem('feedback.text', $text.val());
    });

    $feedback.find('button').click(function(){
      var file = $file.is(':checked');
      var text = $text.val();
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
