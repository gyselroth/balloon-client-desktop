(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const uuid4 = require('uuid4');
const request = require('request');

const clientConfig = require('../../lib/config.js');

const i18n = require('../../lib/i18n.js');
const env = require('../../env.js');
const app = electron.remote.app;


handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

$("document").ready(function() {    
  $("html").addClass(process.platform);
  compileTemplates();

  const logger = require('../../lib/logger.js');
  const clientConfig = require('../../lib/config.js');
  const syncFactory = require('@gyselroth/balloon-node-sync');

  var configuredIgnore = [];
  ipcRenderer.send('selective-window-loaded'); 
  ipcRenderer.on('selective-ignore-path', function (event, path) {
    configuredIgnore = path;
  });

  var sync = syncFactory(clientConfig.getAll(), logger);
  sync.blnApi.getChildren(null, (err, data) => {
    var $list = $('#selective-sync').find('ul');
    $(data).each((id, node) => {
      var html = '<input type="checkbox" name="selected" value="/'+node.name+'"';
      if($.inArray('/'+node.name, configuredIgnore) === -1) {
        html += ' checked';
      }

      $list.append('<li>'+html+'/><span>'+node.name+'</span></li>');
    });
  });

  $('#selective-apply').bind('click', function() {
    var path = [];
    $("#selective-sync").find("input:checkbox:not(:checked)").each(function(){
      path.push($(this).val());
    });

    ipcRenderer.send('selective-apply', path);
  });
  
  $('#selective-cancel').bind('click', function() {
    ipcRenderer.send('selective-cancel');
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
