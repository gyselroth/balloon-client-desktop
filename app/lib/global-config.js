const fs = require('fs');
const path = require('path');

const env = require('../env.js');
const fsUtility = require('./fs-utility.js');
const paths = require('./paths.js');

let configFile;
let config = {};

function initialize() {
  configDir = paths.getConfigDir();

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
