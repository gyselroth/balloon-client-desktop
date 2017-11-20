(function () {
  'use strict'
  const handlebars = require('handlebars')
  const uuid4      = require('uuid4')
  const i18n       = require('../../lib/i18n.js')

  const logger       = require('../../lib/logger.js');
  const clientConfig = require('../../lib/config.js');
  const syncFactory  = require('@gyselroth/balloon-node-sync');

  const electron = require('electron');
  const ipcRenderer = electron.ipcRenderer;

  handlebars.registerHelper('i18n', function (key) {
    var translation = i18n.__(key);

    return new handlebars.SafeString(translation);
  })

  var sync,
      promise = new Promise(function (resolve) {
        if (!clientConfig.get('authMethod')) {
          logger.info('AUTH: no authentication method set yet');
          return resolve();
        }

        clientConfig.retrieveSecret(clientConfig.getSecretType()).then((secret) => {
          clientConfig.setSecret(secret);
          resolve();
        }).catch((error) => {
          logger.error('AUTH: failed retrieve secret from keystore', {error});
          resolve();
        });
      });

  promise.then(() => {
    initNodeSettings();
  });

  function initNodeSettings() {
    sync = syncFactory(clientConfig.getAll(true), logger);

    $(document).ready(function () {
      compileTemplates();
      $('#node-settings-content-data-error').hide();

      var localNode = sync.lstatSync(clientConfig.get('nodePath'));
      sync.find({ino: localNode.ino}, (err, syncedNode) => {
        if (syncedNode && syncedNode[0]) {
          $('#node-settings-content-data-error').hide();
          sync.blnApi.getAttributes({id: syncedNode[0].remoteId, useId: true}, ['id', 'path', 'meta.tags'], (err, data) => {
            logger.info('attributes: ' + JSON.stringify(data));

            var view       = 'preview',
                properties = 'tags',
                error      = !!err,
                nodeData   = error ? {} : data;

            switch (view) {
              case 'preview':
                viewPreview();
                switch (properties) {
                  case 'tags':
                    if (error) {
                      showErrorMessage();
                    } else {
                      propertiesTags(nodeData, {data: nodeData});
                    }
                    break
                  default:
                    break
                }
                break
              default:
                break
            }
          })
        } else {
          showErrorMessage();
        }
      });
    })

    $('.Abbrechen').click(function () {
      closeNodeSettingsWindow();
    })
  }

  function showErrorMessage () {
    $('#node-settings-content-data-error').show();
  }

  function viewPreview () {
    var $fs_meta_tags = $('#node-settings-properties-meta-tags')
    $fs_meta_tags.hide().find('li').remove();

    var $fs_preview_add_tag = $('#node-settings-preview-add-tag'),
        $add                = $fs_preview_add_tag.find('input'),
        $k_add              = $add.data('kendoAutoComplete');

    if ($k_add != undefined) {
      $k_add.destroy();
    }

    //todo show -> for fix height
    // $fs_preview_add_tag.html('<input type="text" name="add_tag"/>').show();
    $fs_preview_add_tag.html('<input type="text" name="add_tag"/>');
    $('#fs-properties-meta-color').find('.fs-color-selected').removeClass('fs-color-selected');
    var $fs_preview_thumb = $('#fs-preview-thumb');

    $fs_preview_thumb.hide().find('.fs-hint').hide();
    $fs_preview_thumb.find('div').html('');
  }

  function propertiesTags (node, data) {
    var $fs_prop_tags = $('#node-settings-properties-meta-tags').show();

    var success = function (data) {
      var children             = [],
          $fs_prop_tags_parent = $fs_prop_tags.parent();

      initMetaTagCompletion();
      $fs_prop_tags_parent.find('.node-settings-add').unbind('click').bind('click', function () {
        $('#node-settings-preview-add-tag').show();
        $fs_prop_tags_parent.find('input:text').focus().data('kendoAutoComplete').search();
      })

      $fs_prop_tags.find('li').remove();
      for (var tag in data.data.meta.tags) {
        children.push('<li><div class="fs-delete">x</div><div class="tag-name">' + data.data.meta.tags[tag] + '</div></li>');
      }
      $fs_prop_tags.find('ul').html(children.join(''));

      handleTags(node);
    }
    if (data !== undefined) {
      success(data);
      return;
    }
  }

  function handleTags (node) {
    var last_tag,
        $fs_prop_tags        = $('#node-settings-properties-meta-tags'),
        $fs_prop_tags_parent = $fs_prop_tags.parent();

    $fs_prop_tags.unbind('click').on('click', 'li', function (e) {
      if ($(e.target).attr('class') == 'fs-delete') {
        $(this).remove();

        var tags = $fs_prop_tags.find('li').map(function () {
          return $(this).find('.tag-name').text();
        }).get();

        if (tags.length === 0) {
          tags = '';
        }

        saveMetaAttributes(node, {tags: tags});
        return;
      }
    })

    $fs_prop_tags_parent.find('input[name=add_tag]').unbind('keypress').keypress(function (e) {
      $(document).unbind('click').click(function (e) {
        return metaTagHandler(node, e, last_tag);
      });

      last_tag = $(this);
      return metaTagHandler(node, e, last_tag);
    })
  }

  function saveMetaAttributes(node, meta) {
    sync.blnApi.createMetaAttributes(node.id, {tags: meta.tags}, (err, data) => {
      for (var attr in meta) {
        if (meta[attr] == '') {
          delete node.meta[attr];
        } else {
          node.meta[attr] = meta[attr];
        }
      }
    })
  }

  function metaTagHandler(node, e, $last_tag) {
    var code    = (!e.charCode ? e.which : e.charCode),
        strcode = String.fromCharCode(!e.charCode ? e.which : e.charCode);

    if (e.type == 'click' || code == 13 || code == 32 || code == 0) {
      var value = $last_tag.val();

      if (value == '') {
        return;
      }

      if (node.meta.tags !== undefined && node.meta.tags.indexOf(value) != -1) {
        return false;
      }

      var $fs_prop_tags = $('#node-settings-properties-meta-tags');
      if ($last_tag.attr('name') == 'add_tag') {
        $fs_prop_tags.find('ul').append('<li><div class="fs-delete">x</div><div class="tag-name">' + value + '</div></li>');
        $last_tag.val('').focus();
      } else {
        var $parent = $last_tag.parent();
        $last_tag.remove();
        $parent.html('<div class="tag-name">' + value + '</div><div class="fs-delete">x</div>');
      }

      var tags = $fs_prop_tags.find('li').map(function () {
        return $(this).find('.tag-name').text();
      }).get()

      $(document).unbind('click');

      saveMetaAttributes(node, {tags: tags});

      e.preventDefault();
    }

    var allowed = new RegExp('^[a-zA-Z0-9\-\_]+$');
    if (allowed.test(strcode) || code == 8) {
      return true;
    }

    e.preventDefault();
    return false;
  }

  function initMetaTagCompletion() {
    var $meta_tags        = $('#node-settings-properties-meta-tags'),
        $meta_tags_parent = $meta_tags.parent(),
        $input            = $meta_tags_parent.find('input');

    $input.kendoAutoComplete({
      minLength    : 0,
      dataTextField: '_id',
      dataSource   : new kendo.data.DataSource({
        transport: {
          read: function (operation) {
            sync.blnApi.getNodeAttributeSummary({attributes: ['meta.tags']}, (err, data) => {
              data['meta.tags'].sort();
              operation.success(data['meta.tags']);
            })

          }
        }
      }),
      sort         : {
        dir  : 'asc',
        field: '_id'
      },
      change       : function (e) {
        this.dataSource.read();
      },
    })

    $input.unbind('focus').bind('focus', function () {
      $meta_tags.addClass('fs-select-tags');
      $input.data('kendoAutoComplete').search();
    })

    $input.unbind('blur').bind('blur', function () {
      $meta_tags.removeClass('fs-select-tags');
    })
  }

  function closeNodeSettingsWindow() {
    //todo ipcMain not found running on sub process?!
    ipcRenderer.send('node-settings-close');
  }

  function compileTemplates () {
    var templateContentHtml = $('#template-content').html();
    var $placeholderContent = $('#contentWrapper');
    var templateContent     = handlebars.compile(templateContentHtml);

    $placeholderContent.html(templateContent());
  }
}())
