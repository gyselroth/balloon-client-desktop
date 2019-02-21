(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const async = require('async');

const clientConfig = require('../../lib/config.js');
const globalConfig = require('../../lib/global-config.js');

const logger = require('../../lib/logger.js');
const loggerFactory = require('../../lib/logger-factory.js');
const {fullSyncFactory} = require('@gyselroth/balloon-node-sync');
const IgnoredNodes = require('./ignored-nodes.js');

const standardLogger = new loggerFactory(clientConfig.getAll());
logger.setLogger(standardLogger);


const i18n = require('../../lib/i18n.js');
const env = require('../../env.js');
const app = electron.remote.app;

let ignoredNodes;
let sync;

handlebars.registerHelper('i18n', function(key) {
  var translation = i18n.__(key);

  return new handlebars.SafeString(translation);
});

window.onerror = function(message, url, line, column, error) {
  logger.error(message, {category: 'selective', url, line, column, error});

  ipcRenderer.send('selective-error', error, url, line, message);
};

$('document').ready(function() {
  $('html').addClass(process.platform);
  compileTemplates();

  ipcRenderer.send('selective-window-loaded');

  ipcRenderer.once('secret', function(event, type, secret) {
    var config = clientConfig.getAll(true);
    config[type] = secret;
    config.version = globalConfig.get('version');

    initialize(config);
  });

  $('#selective-sync-apply-active').hide();

  $('#selective-apply').bind('click', function(event) {
    logger.info('apply selective sync settings', {category: 'selective', ignoredNodes});

    isUpdateing();
    ipcRenderer.send('selective-apply', $('#collection-tree').jstree(true).get_difference($.jstree.root));
  });

  $('#selective-cancel').bind('click', function() {
    ipcRenderer.send('selective-close');
  });
});

function initialize(config) {
  sync = fullSyncFactory(config, logger);
  sync.getIgnoredRemoteIds((err, currentlyIgnoredIds) => {
    if(err) throw err;

    logger.debug('Got ignored remote ids', {category: 'selective', currentlyIgnoredIds});

    // initialize ignoredNodes
    sync.blnApi.getAttributesByIds(currentlyIgnoredIds, ['path', 'id'], (err, nodes) => {
      if(err) throw err;

      ignoredNodes = new IgnoredNodes(nodes);

      initializeTree();
    });
  });
}

function initializeTree() {
  $('#collection-tree').jstree({
    core : {
      data : function(parentNode, callback) {
        var nodeId = (parentNode.id === '#' ? null : parentNode.id);

        sync.blnApi.getChildren(nodeId, {filter: {directory: true}, attributes: ['id', 'name', 'path', 'size', 'reference', 'shared']}, (err, nodes) => {
          // TODO pixtron - handle errors
          if(err) throw err;

          logger.debug('Got children', {category: 'selective', nodes, parent: nodeId});

          if(nodeId === null && nodes.length === 0) {
            $('#warning-no-collections-in-root').show();
            $('#collection-tree').hide();
            $('#selective-apply').hide();
            callback([]);
          } else {
            callback(prepareNodesForRendering(parentNode, nodes));
          }
        });
      }
    },
    plugins: ['ignored'],
    ignored: {},
  });
}

function prepareNodesForRendering(parentNode, nodes) {
  return nodes
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(node => {
      var icon;
      if(node.reference === true) {
        icon = 'gr-icon gr-i-folder-received';
      } else if(node.shared === true) {
        icon = 'gr-icon gr-i-folder-shared';
      } else {
        icon = 'gr-icon gr-i-folder';
      }

      return {
        id: node.id,
        parent: parentNode.id,
        text: node.name,
        children: (node.size > 0),
        data: node,
        icon: icon,
        state: {
          opened: false,
          disabled: false,
          selected: !ignoredNodes.isIgnored(node),
          undetermined: ignoredNodes.hasIgnoredChildren(node)
        },
        li_attr : {},
        a_attr : {}
      };
    });
}

function compileTemplates() {
  var templateContentHtml = $('#template-content').html();
  var $placeholderContent = $('#content-wrapper');
  var templateContent = handlebars.compile(templateContentHtml);

  var context = {};

  $placeholderContent.html(templateContent(context));
}
}());

function isUpdateing() {
  $('#selective-sync-choose').hide();
  $('#selective-sync-apply-active').show();
}
