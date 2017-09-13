const fs = require('fs');
const path = require('path');

const env = require('../env.js');
const fsUtility = require('./fs-utility.js');

let configFile;
let config = {};

function initialize() {
  const homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
  const user = process.env[(/^win/.test(process.platform)) ? 'USERNAME' : 'USER'];
  let configDir;


  if(env.configDir) {
    configDir = env.configDir.replace('{home}', homeDir).replace('{username}', user);
  } else {
    configDir = path.join(homeDir, '.balloon');
  }

  fsUtility.createConfigDir(configDir);

  configFile  = path.join(configDir, 'config-'+env.name+'.json');

  readConfig();
}

function readConfig() {
  try {
    if(fs.existsSync(configFile)) {
      config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    }
  } catch(err) {
    return {};
  }
}

function saveConfig() {
  fs.writeFileSync(configFile, JSON.stringify(config || {}), 'utf8');
}


module.exports = function() {
  initialize();

  return {
    get: function(key) {
      return config[key];
    },
    set: function(key, value) {
      config[key] = value;
      saveConfig();
    }
  }
}();
