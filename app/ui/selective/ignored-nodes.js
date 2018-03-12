
const escapeStringRegexp = require('escape-string-regexp');

class IgnoredNodes {

  constructor(nodes=[]) {
    this.nodes = nodes;
  }

  add(node) {
    this.nodes.push({
      id: node.id,
      path: node.path
    });
  }

  remove(node) {
    this.nodes = this.nodes.filter(candidate => {
      if(candidate.id === node.id) return false;

      var regex = new RegExp('^' + escapeStringRegexp(candidate.path) + '(\/.*|)$');

      return regex.test(node.path);
    });
  }

  isIgnored(node) {
    //self ignored or parent is ignored;
    return this.nodes.filter(candidate => {
      if (node.id === candidate.id) return true;

      var regex = new RegExp('^' + escapeStringRegexp(candidate.path) + '(\/.*|)$');

      return regex.test(node.path);
    }).length > 0;
  }

  hasIgnoredChildren(node) {
    return this.nodes.filter(candidate => {
      if(node.id === candidate.id) return false;

      var regex = new RegExp('^' + escapeStringRegexp(node.path) + '(\/.*|)$');

      return regex.test(candidate.path);
    }).length > 0;
  }
}

module.exports = IgnoredNodes;
