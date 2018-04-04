(function () {'use strict';

const electron = require('electron');
const ipcRenderer = electron.ipcRenderer;
const handlebars = require('handlebars');
const async = require('async');

const clientConfig = require('../../lib/config.js');

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

$('document').ready(function() {
  $('html').addClass(process.platform);
  compileTemplates();

  ipcRenderer.send('selective-window-loaded');

  ipcRenderer.once('secret', function(event, type, secret) {
    var config = clientConfig.getAll(true);
    config[type] = secret;

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
    // TODO pixtron - handle errors
    if(err) throw err;

    logger.debug('Got ignored remote ids', {category: 'selective', currentlyIgnoredIds});

    // initialize ignoredNodes
    sync.blnApi.getAttributesByIds(currentlyIgnoredIds, ['path', 'id'], (err, nodes) => {
      // TODO pixtron - handle errors
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

        sync.blnApi.getChildren(nodeId, {filter: {directory: true}, attributes: ['id', 'name', 'path', 'size']}, (err, nodes) => {
          // TODO pixtron - handle errors
          if(err) throw err;

          logger.debug('Got children', {category: 'selective', nodes, parent: nodeId});

          callback(prepareNodesForRendering(parentNode, nodes));
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
      return {
        id: node.id,
        parent: parentNode.id,
        text: node.name,
        children: (node.size > 0),
        data: node,
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
