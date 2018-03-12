/**
 * ### Ignore plugin for balloon-client-dektop
 *
 * This plugin renders checkbox icons in front of each node, making multiple selection much easier.
 * It also supports tri-state behavior, meaning that if a node has a few of its children checked it will be rendered as undetermined, and state will be propagated up.
 *
 * This is an adoption of the jstree.checkbox plugin from Ivan Bozhanov:
 * https://github.com/vakata/jstree/blob/master/src/jstree.checkbox.js
 *
 * Copyright (c) 2014 Ivan Bozhanov
 * Copyright (c) 2018 Gyselroth GmbH
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
(function (factory) {
  factory($, $.jstree);
}(function ($, jstree, undefined) {
  "use strict";

  if($.jstree.plugins.ignored) { return; }

  var _i = document.createElement('I');
  _i.className = 'jstree-icon jstree-checkbox';
  _i.setAttribute('role', 'presentation');

  /**
   * stores all defaults for the checkbox plugin
   * @name $.jstree.defaults.ignored
   * @plugin ignored
   */
  $.jstree.defaults.ignored = {};

  $.jstree.plugins.ignored = function (options, parent) {

    this.bind = function () {
      parent.bind.call(this);

      this.element
        .on('init.jstree', $.proxy(function () {
            this.element.addClass('jstree-checkbox-no-clicked');
            this.element.addClass('jstree-checkbox-selection');
          }, this))
        .on('loading.jstree', $.proxy(function () {
          }, this))
        .on('model.jstree', $.proxy(function (e, data) {
            var m = this._model.data,
              p = m[data.parent],
              dpc = data.nodes,
              pos = undefined,
              ps = p.state,
              chd = [],
              c, i, j, k, l, tmp;

            //on children we might have to change the state if it changed on the parent
            if(p.id !== $.jstree.root && p.original && p.original.state) {
              pos = p.original.state;

              //if original undetermined state changed
              if(pos.undetermined && !ps.undetermined) {
                if(ps.selected) {
                  for(i = 0, j = dpc.length; i < j; i++) {
                    m[dpc[i]].state.selected = true;
                    m[dpc[i]].state.undetermined = false;
                  }

                  this._data.core.selected = this._data.core.selected.concat(dpc);
                } else {
                  for(i = 0, j = dpc.length; i < j; i++) {
                    m[dpc[i]].state.selected = false;
                    m[dpc[i]].state.undetermined = false;
                  }
                }
              }
            }

            this._data.core.selected = $.vakata.array_unique(this._data.core.selected);
          }, this))
        .on('select_node.jstree', $.proxy(function (e, data) {
            var self = this,
              obj = data.node,
              m = this._model.data,
              par = this.get_node(obj.parent),
              i, j, c, tmp,
              sel = {}, cur = this._data.core.selected;

            for (i = 0, j = cur.length; i < j; i++) {
              sel[cur[i]] = true;
            }

            // apply down
            var selectedIds = this._cascade_new_checked_state(obj.id, true);
            var temp = obj.children_d.concat(obj.id);
            for (i = 0, j = temp.length; i < j; i++) {
              if (selectedIds.indexOf(temp[i]) > -1) {
                sel[temp[i]] = true;
              } else {
                delete sel[temp[i]];
              }
            }

            // apply up
            while(par && par.id !== $.jstree.root) {
              var undetermined = false;

              for(i = 0, j = par.children.length; i < j; i++) {
                if(m[par.children[i]].state.undetermined === true || m[par.children[i]].state.selected === false) {
                  undetermined = true;
                  break;
                }
              }

              par.state.selected = true;
              par.state.undetermined = undetermined;
              sel[par.id] = true;
              tmp = this.get_node(par, true);
              if(tmp && tmp.length) {
                tmp.attr('aria-selected', true).children('.jstree-anchor').addClass('jstree-clicked');

                if(undetermined === false) {
                  tmp.attr('aria-selected', true).children('.jstree-anchor').children('.jstree-checkbox').removeClass('balloon-has-ignored-children');
                } else {
                  tmp.attr('aria-selected', true).children('.jstree-anchor').children('.jstree-checkbox').addClass('balloon-has-ignored-children');
                }
              }

              par = this.get_node(par.parent);
            }

            cur = [];
            for (i in sel) {
              if (sel.hasOwnProperty(i)) {
                cur.push(i);
              }
            }
            this._data.core.selected = cur;
          }, this))
        .on('deselect_node.jstree', $.proxy(function (e, data) {
              var self = this,
                obj = data.node,
                dom = this.get_node(obj, true),
                par = this.get_node(obj.parent),
                i, j, tmp,
                cur = this._data.core.selected, sel = {},
                allIds = obj.children_d.concat(obj.id);

              // apply down
              var selectedIds = this._cascade_new_checked_state(obj.id, false);

              cur = cur.filter(function(id) {
                return allIds.indexOf(id) === -1 || selectedIds.indexOf(id) > -1;
              });

              // apply up
              while(par && par.id !== $.jstree.root) {
                par.state.undetermined = true;
                tmp = this.get_node(par, true);

                if(tmp && tmp.length) {
                  tmp.attr('aria-selected', true).children('.jstree-anchor').children('.jstree-checkbox').addClass('balloon-has-ignored-children');
                }

                par = this.get_node(par.parent);
              }

              this._data.core.selected = cur;
            }, this))
    };

    this.redraw_node = function(obj, deep, is_callback, force_render) {
      obj = parent.redraw_node.apply(this, arguments);

      if(obj) {
        var i, j, tmp = null, icon = null, m;
        for(i = 0, j = obj.childNodes.length; i < j; i++) {
          if(obj.childNodes[i] && obj.childNodes[i].className && obj.childNodes[i].className.indexOf("jstree-anchor") !== -1) {
            tmp = obj.childNodes[i];
            break;
          }
        }
        if(tmp) {
          m = this._model.data[obj.id];
          icon = _i.cloneNode(false);

          if(m.state.checkbox_disabled) { icon.className += ' jstree-checkbox-disabled'; }

          if(m.state.selected && m.state.undetermined) {
            icon.className += ' balloon-has-ignored-children';
          }

          tmp.insertBefore(icon, tmp.childNodes[0]);
        }
      }

      return obj;
    };

    this.activate_node = function (obj, e) {
      if($(e.target).hasClass('jstree-checkbox-disabled')) {
        return false;
      }
      if($(e.target).hasClass('jstree-checkbox')) {
        e.ctrlKey = true;
      }
      if(this.is_disabled(obj)) {
        return false;
      }

      if(this.is_checked(obj)) {
        this.uncheck_node(obj, e);
      } else {
        this.check_node(obj, e);
      }

      this.trigger('activate_node', { 'node' : this.get_node(obj) });
    };

    /**
     * Cascades checked state to a node and all its descendants. This function does NOT affect hidden and disabled nodes (or their descendants).
     * However if these unaffected nodes are already selected their ids will be included in the returned array.
     * @private
     * @param {string} id the node ID
     * @param {bool} checkedState should the nodes be checked or not
     * @returns {Array} Array of all node id's (in this tree branch) that are checked.
     */
    this._cascade_new_checked_state = function (id, checkedState) {
      var self = this;
      var node = this._model.data[id];
      var selectedNodeIds = [];
      var selectedChildrenIds = [], i, j, selectedChildIds;

      //First try and check/uncheck the children
      if (node.children) {
        for (i = 0, j = node.children.length; i < j; i++) {
          var childId = node.children[i];
          selectedChildIds = self._cascade_new_checked_state(childId, checkedState);
          selectedNodeIds = selectedNodeIds.concat(selectedChildIds);
          if (selectedChildIds.indexOf(childId) > -1) {
            selectedChildrenIds.push(childId);
          }
        }
      }

      var dom = self.get_node(node, true);

      node.state.selected = checkedState;

      //if the checkedState === true (i.e. the node is being checked now) and all of the node's children are checked (if it has any children),
      //check the node and style it correctly.
      if (checkedState) {
        selectedNodeIds.push(node.id);

        dom.attr('aria-selected', true).children('.jstree-anchor').addClass('jstree-clicked');
      } else {
        node.state.selected = false;
        dom.attr('aria-selected', false).children('.jstree-anchor').removeClass('jstree-clicked');
      }

      dom.children('.jstree-anchor').children('.jstree-checkbox').removeClass('balloon-has-ignored-children')
      node.state.undetermined = false;

      return selectedNodeIds;
    };

    /**
     * Gets ids of nodes selected in branch (of tree) specified by id (does not include the node specified by id)
     * @name get_checked_descendants(obj)
     * @param {string} id the node ID
     * @return {Array} array of IDs
     * @plugin checkbox
     */
    this.get_checked_descendants = function (id) {
      var self = this;
      var node = self._model.data[id];

      return node.children_d.filter(function(_id) {
        return self._model.data[_id].state.selected;
      });
    };

    /**
     * check a node
     * @name check_node(obj)
     * @param {mixed} obj an array can be used to check multiple nodes
     * @trigger check_node.jstree
     * @plugin checkbox
     */
    this.check_node = function (obj, e) {
      return this.select_node(obj, false, true, e);
    };

    /**
     * uncheck a node
     * @name uncheck_node(obj)
     * @param {mixed} obj an array can be used to uncheck multiple nodes
     * @trigger uncheck_node.jstree
     * @plugin checkbox
     */
    this.uncheck_node = function (obj, e) {
      return this.deselect_node(obj, false, e);
    };

    /**
     * checks all nodes in the tree
     * @name check_all()
     * @trigger check_all.jstree, changed.jstree
     * @plugin checkbox
     */
    this.check_all = function () {
      return this.select_all();
    };

    /**
     * uncheck all checked nodes
     * @name uncheck_all()
     * @trigger uncheck_all.jstree
     * @plugin checkbox
     */
    this.uncheck_all = function () {
      return this.deselect_all();
    };

    /**
     * checks if a node is checked
     * @name is_checked(obj)
     * @param  {mixed}  obj
     * @return {Boolean}
     * @plugin checkbox
     */
    this.is_checked = function (obj) {
      return this.is_selected(obj);
    };

    /**
     * get an array of all checked nodes
     * @name get_checked([full])
     * @param  {mixed}  full if set to `true` the returned array will consist of the full node objects, otherwise - only IDs will be returned
     * @return {Array}
     * @plugin checkbox
     */
    this.get_checked = function (full) {
      return this.get_selected(full);
    };

    /**
     * get an array of all top level checked nodes (ignoring children of checked nodes)
     * @name get_top_checked([full])
     * @param  {mixed}  full if set to `true` the returned array will consist of the full node objects, otherwise - only IDs will be returned
     * @return {Array}
     * @plugin checkbox
     */
    this.get_top_checked = function (full) {
      return this.get_top_selected(full);
    };

    /**
     * get an array of all bottom level checked nodes (ignoring selected parents)
     * @name get_bottom_checked([full])
     * @param  {mixed}  full if set to `true` the returned array will consist of the full node objects, otherwise - only IDs will be returned
     * @return {Array}
     * @plugin checkbox
     */
    this.get_bottom_checked = function (full) {
      return this.get_bottom_selected(full);
    };

    this.get_difference = function(nodeId) {
      var par = this._model.data[nodeId],
          result = {},
          i, j;

      for(i=0, j=par.children.length; i<j; i++) {
        var child = this._model.data[par.children[i]],
            state = child.state,
            origState = child.original.state,
            canBeIgnored = false,
            node = {
              id: child.id,
              path: child.data.path,
              parent: child.parent,
              state: {selected: state.selected, undetermined: state.undetermined},
              origState: {selected: origState.selected, undetermined: origState.undetermined},
              children: []
            };

        if(state.selected === true) {
          //if it was previously selected and not undetermined, children did not change. Ignore in difference
          if(state.undetermined === false && origState.selected === true && origState.undetermined === false) canBeIgnored = true;

          //if parent was previously deselected children will be downloaded anyway. Ignore in difference
          if(par.original && par.original.state && par.original.state.selected === false) canBeIgnored = true;

          if(state.undetermined === true || origState.undetermined === true) {
            //if it is undetermined recurse into children, in order to detect possible changes
            Object.assign(result, this.get_difference(child.id));

            node.children = child.children.filter(id => result[id] !== undefined);

            //if it was previously selected and no changes in childnodes found, ignore it in difference
            if(origState.selected === true && node.children.length === 0) canBeIgnored = true;
          }
        } else {
          //if it is currently deselected and was previously deselected and parent was not newly selected, did not change. Ignore in difference
          const parent = this._model.data[child.parent];
          if(origState.selected === false && (!parent.original || !parent.original.state || parent.original.state.selected === true)) canBeIgnored = true;
        }

        if(canBeIgnored === false) result[child.id] = node;
      }

      if(nodeId === $.jstree.root) {
        const changedChildren = par.children.filter(id => result[id] !== undefined);

        if(changedChildren.length > 0) {
          //add root node to result if at least one child has changes
          result[$.jstree.root] = {
            id: $.jstree.root,
            children: changedChildren
          };
        }
      }

      return result;
    }
  };
}));
