const fs = require('graceful-fs');
const path = require('path');
const childProcess = require('child_process');

const electron = require('electron');
const settings = require('electron-settings');
const app = electron.app || electron.remote.app;
const keytar = require('keytar');

const env = require('../env.js');
const instance = require('./instance.js');
const fsUtility = require('./fs-utility.js');

var configExists   = false;
var activeInstance = false;
var memorySettings = {};

function initialize() {
  activeInstance = instance.getActiveInstance();

  var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
  var configDirName = env.configDirName || '.balloon';
  var newSettings = {};
  var balloonDir = path.join(homeDir, env.balloonDirName || 'Balloon');
  var configDir = path.join(homeDir, configDirName);
    
  if(!fs.existsSync(configDir)) {
    fsUtility.mkdirpSync(configDir);

    if(process.platform === 'win32') {
      //"Hide" configDir on win32
      childProcess.execSync('ATTRIB +H ' + configDir);
    }
  }
  
  //If we do not have an active instance we're going to store any config in memory first
  if(activeInstance) {
    var instanceDir = path.join(configDir, activeInstance);
    var configFile  = path.join(instanceDir, env.configFileName || 'config.json');
    configExists = fs.existsSync(configFile);

    if(!fs.existsSync(instanceDir)) {
      fsUtility.mkdirpSync(instanceDir);
    }

    settings.setPath(configFile);
    newSettings = settings.getAll();

    newSettings.configFile  = configFile;
    newSettings.instanceDir = instanceDir;
  } else {
    configExists = false;
  }

  newSettings.configDir  = newSettings.configDir || configDir;
  newSettings.homeDir    = newSettings.homeDir || homeDir;
  newSettings.balloonDir = newSettings.balloonDir || balloonDir;
  newSettings.context    = env.name || 'production';

  if(env.blnUrl) {
    newSettings.blnUrl = env.blnUrl;

    if(env.apiPath) {
      newSettings.apiUrl = env.blnUrl+env.apiPath;
    } else {
      newSettings.apiUrl = env.blnUrl+'/api/v1/';
    }
  }

  if(activeInstance) {
    settings.setAll(newSettings);
    for(key in memorySettings) {
      if(key !== 'password' && key !== 'accessToken') {
        settings.set(key, memorySettings[key]);
      }
    }
  } else {
    memorySettings = newSettings;
  }
}

module.exports = function() {
  initialize();

  function getSecretType() { 
    var method;
    if(activeInstance) {
      method = settings.get('authMethod');
    } else {
      method = memorySettings['authMethod'];
    }
      
    if(method === 'basic') {
      return 'password';
    } else if(method === 'oidc') {
      return 'accessToken';
    }
  }

  var secret, traySecretUpdate;

  return {
    isActiveInstance: function() {
      return instance.getActiveInstance();
    },
    hadConfig: function() {
      return configExists;
    },
    getAll: function(include_secret) {
      if(activeInstance) {
        var conf = settings.getAll();
      } else {
        var conf = memorySettings;
      }

      if(include_secret === true && getSecretType()) {
        conf[getSecretType()] = secret; 
      }
      return conf;
    },
    get: function(key) {
      if(activeInstance) {
        return settings.get(key);
      } else {
        return memorySettings[key];
      }
    },
    getMulti: function(keys) {
      var valuesToReturn = {};
      keys.forEach((key) => {
        valuesToReturn[key] = settings.get(key);
      });

      return valuesToReturn;
    },
    setAll: function(newSettings) {
      settings.setAll(newSettings);
    },
    setMulti: function(newSettings) {
      for(key in newSettings) {
        settings.set(key, newSettings[key]);
      }
    },
    set: function(key, value) {
      if(activeInstance) {
        settings.set(key, value);
      } else {
        memorySettings[key] = value = value;
      }
    },
    setBlnUrl: function(url) {
      var apiUrl = url + env.apiPath;

      if(activeInstance) {
        settings.set('blnUrl', url);
        settings.set('apiUrl', apiUrl);
      } else {
        memorySettings['blnUrl'] = url;
        memorySettings['apiUrl'] = apiUrl;
      }
    },
    initialize,
    setSecret: function(key) {
      secret = key;
    },
    getSecret: function() {
      return secret;
    },
    getSecretType,
    hasSecret: function() {
      if(secret === undefined) {
        return false;
      } else {
        return true;
      } 
    },
    destroySecret: function(type) {
      secret = undefined;
      traySecretUpdate();
      return keytar.deletePassword('balloon', type);
    },
    storeSecret: function(type, key) {
      secret = key;
      traySecretUpdate();
      return keytar.setPassword('balloon', type, key);
    },
    retrieveSecret: function(type) {
      return keytar.getPassword('balloon', type);
    },
    updateTraySecret: function(callee) {
      traySecretUpdate = callee;
    },
    /**
     * @var string||array id node id(s) to ingore
     */
    ignoreNode: function(id) {
      if(id.constructor === String) {
        id = [id];
      }

      if(id.constructor !== Array) {
        throw(new Error('id must be a string or an array'));
      }

      var ignoreNodes = settings.get('ignoreNodes');
      if(!ignoreNodes) {
        ignoreNodes = [];
      }

      ignoreNodes = ignoreNodes.concat(id);

      ignoreNodes = [...new Set(ignoreNodes)];

      settings.set('ignoreNodes', ignoreNodes);
    },
  }
}();
