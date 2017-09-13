const path = require('path');

const env = require('../env.js');

var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
var user = process.env[(/^win/.test(process.platform)) ? 'USERNAME' : 'USER'];

module.exports = {
  getConfigDir: function() {
    if(env.configDir) {
      return env.configDir.replace('{home}', homeDir).replace('{username}', user);
    } else {
      return path.join(homeDir, '.balloon');
    }
  },

  getBalloonDir: function() {
    if(env.balloonDir) {
      return env.balloonDir.replace('{home}', homeDir).replace('{username}', user);
    } else {
      return path.join(homeDir, 'Balloon');
    }
  },

  getInstancesFile: function() {
    const configDir = this.getConfigDir();
    return path.join(configDir, 'instances.json');
  },

  getInstanceDir: function(instanceName) {
    if(instanceName === undefined) throw(new Error('No instanceName supplied'));

    return path.join(this.getConfigDir(), instanceName);
  },

  homeDir: function() {
    return homeDir;
  }
}
