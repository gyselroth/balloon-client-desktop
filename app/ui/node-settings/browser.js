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

  handlebars.registerHelper('i18n', (key) => {
    var translation = i18n.__(key);

    return new handlebars.SafeString(translation);
  })

  var sync,
      promise = new Promise((resolve) => {
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

    $(document).ready(() => {
      var localNode = sync.lstatSync(clientConfig.get('nodePath'))
      sync.find({ino: localNode.ino}, (err, syncedNode) => {
        if (syncedNode && syncedNode[0]) {
          sync.blnApi.getAttributes({id: syncedNode[0].remoteId, useId: true}, ['id', 'path', 'meta.tags', 'changed'], (err, data) => {
            logger.info('attributes: ' + JSON.stringify(data))
            var view       = 'preview',
                properties = 'tags',
                error      = !!err,
                nodeData   = error ? {} : data
            nodeSettingsCompileTemplates(nodeData)
            initNodeSettingsButtons(nodeData)
            switch (view) {
              case 'preview':
                nodeSettingsViewPreview()
                switch (properties) {
                  case 'tags':
                    if (error) {
                      nodeSettingsShowErrorMessage()
                    } else {
                      nodeSettingsPropertiesTags(nodeData, {data: nodeData})
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
          nodeSettingsCompileTemplates()
          initNodeSettingsButtons()
          nodeSettingsShowErrorMessage()
        }
      })
    })
  }

  function nodeSettingsShowErrorMessage (errorMessage) {
    if (errorMessage) {
      $('#node-settings-error').html(errorMessage).show()
    } else {
      $('#node-settings-error').show()
    }

    $('#node-settings-header').hide()
    $('#node-settings-properties').hide()
    $('#node-settings-button-save').hide()
  }

  function nodeSettingsViewPreview () {
    var $fs_meta_tags = $('#node-settings-properties-meta-tags')
    $fs_meta_tags.hide().find('li').remove();

    var $fs_preview_add_tag = $('#node-settings-properties-add-tag'),
        $add                = $fs_preview_add_tag.find('input'),
        $k_add              = $add.data('kendoAutoComplete');

    if ($k_add != undefined) {
      $k_add.destroy();
    }

    $fs_preview_add_tag.html('<input type="text" name="add_tag"/>');
    $('#fs-properties-meta-color').find('.fs-color-selected').removeClass('fs-color-selected');
    var $fs_preview_thumb = $('#fs-preview-thumb');

    $fs_preview_thumb.hide().find('.fs-hint').hide();
    $fs_preview_thumb.find('div').html('');
  }

  function nodeSettingsPropertiesTags (node, data) {
    var $fs_prop_tags = $('#node-settings-properties-meta-tags').show();

    var success = function (data) {
      var children             = [],
          $fs_prop_tags_parent = $fs_prop_tags.parent();

      nodeSettingsInitMetaTagCompletion();
      $fs_prop_tags_parent.find('.node-settings-properties-add').unbind('click').bind('click', function () {
        $('#node-settings-properties-add-tag').show();
        $fs_prop_tags_parent.find('input:text').focus().data('kendoAutoComplete').search();
      })

      $fs_prop_tags.find('li').remove();
      for (var tag in data.data.meta.tags) {
        children.push('<li><div class="fs-delete">x</div><div class="tag-name">' + data.data.meta.tags[tag] + '</div></li>');
      }
      $fs_prop_tags.find('ul').html(children.join(''));

      nodeSettingsHandleTags(node);
    }
    if (data !== undefined) {
      success(data);
      return;
    }
  }

  function nodeSettingsHandleTags (node) {
    var last_tag,
        $fs_prop_tags        = $('#node-settings-properties-meta-tags'),
        $fs_prop_tags_parent = $fs_prop_tags.parent();

    $fs_prop_tags.unbind('click').on('click', 'li', function (e) {
      if ($(e.target).attr('class') == 'fs-delete') {
        $(this).remove();
        return;
      }
    })

    $fs_prop_tags_parent.find('input[name=add_tag]').unbind('keypress').keypress(function (e) {
      $(document).unbind('click').click(function (e) {
        return nodeSettingsMetaTagHandler(node, e, last_tag);
      });

      last_tag = $(this);
      return nodeSettingsMetaTagHandler(node, e, last_tag);
    })
  }

  function nodeSettingsMetaTagHandler(node, e, $last_tag) {
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
      e.preventDefault();
    }

    var allowed = new RegExp('^[a-zA-Z0-9\-\_]+$');
    if (allowed.test(strcode) || code == 8) {
      return true;
    }

    e.preventDefault();
    return false;
  }

  function nodeSettingsInitMetaTagCompletion() {
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
              if (err) {
                nodeSettingsShowErrorMessage(err.message);
              } else {
                data['meta.tags'].sort();
                operation.success(data['meta.tags']);
              }
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

  function closeNodeSettingsWindow () {
    console.log('ipcRenderer', ipcRenderer)

    //todo does not work in the sub process
    ipcRenderer.send('node-settings-close');
  }

  function nodeSettingsCompileTemplates (node) {
    var templateContentHtml = $('#node-settings-template-content').html();
    var $placeholderContent = $('#node-settings-contentWrapper');
    var templateContent     = handlebars.compile(templateContentHtml);

    var context = {}
    if (node) {
      var locale     = i18n.getCurrentLocale(),
          nodeChange = new Date(node.changed.sec * 1000)
      context        = {
        nodePath           : node.path,
        nodeChangeDayLong  : nodeChange.toLocaleString(locale, {weekday: 'long'}),
        nodeChangeMonthDay : nodeChange.getDate(),
        nodeChangeMonthLong: nodeChange.toLocaleDateString(locale, {month: 'long'}),
        nodeChangeYear     : nodeChange.toLocaleDateString(locale, {year: 'numeric'}),
        nodeChangeTime     : nodeChange.getHours() + ':' + nodeChange.getMinutes(),
      }
    }

    $placeholderContent.html(templateContent(context))
    $('#node-settings-error').hide()
  }

  function initNodeSettingsButtons(node) {
    $('#node-settings-button-cancel').click(function () {
      console.log('cancel')
      closeNodeSettingsWindow();
    })

    $('#node-settings-button-save').click(function () {
      console.log('save')
      var tags = $('#node-settings-properties-meta-tags').find('li').map(function () {
        return $(this).find('.tag-name').text();
      }).get()

      var meta = {
        tags: tags.length === 0 ? null : tags
      }
      sync.blnApi.createMetaAttributes(node.id, {tags: meta.tags}, (err, data) => {
        if (err) {
          nodeSettingsShowErrorMessage(err.message);
        } else {
          for (var attr in meta) {
            if (meta[attr] == '') {
              delete node.meta[attr];
            } else {
              node.meta[attr] = meta[attr];
            }
          }
          closeNodeSettingsWindow();
        }
      })
    })
  }
}())
