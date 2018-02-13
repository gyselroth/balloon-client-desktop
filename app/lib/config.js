const fs = require('graceful-fs');
const path = require('path');

const electron = require('electron');

if(process.type === 'browser') {
  var settings = require('electron-settings');
} else {
  var settings = electron.remote.require('electron-settings');
}

const app = electron.app || electron.remote.app;
const keytar = require('keytar');

const env = require('../env.js');
const instance = require('./instance.js');
const fsUtility = require('./fs-utility.js');
const paths = require('./paths.js');

var configExists   = false;
var activeInstance = false;
var memorySettings = {};

function initialize(syncMemory, mainSync) {
  if(syncMemory === undefined) {
    syncMemory = true;
  }

  instance.initialize();
  activeInstance = instance.getActiveInstance();

  var newSettings = {};

  var configDir = paths.getConfigDir();
  var balloonDir = paths.getBalloonDir();

  fsUtility.createConfigDir(configDir);

  //If we do not have an active instance we're going to store any config in memory first
  if(activeInstance) {
    var instanceDir = paths.getInstanceDir(activeInstance);
    var configFile  = path.join(instanceDir, env.configFileName || 'config-'+env.name+'.json');

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
  newSettings.homeDir    = newSettings.homeDir || paths.homeDir();
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

  //only write default or startup settings in <main>
  if(activeInstance) {
    if(process.type === 'browser') {
      settings.setAll(newSettings);
      if(syncMemory) {
        for(key in memorySettings) {
          if(env.auth && env.auth.secretStorage === 'config' || (key !== 'password' && key !== 'accessToken') ) {
            settings.set(key, memorySettings[key]);
          }
        }
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

  function set(key, value) {
    if(activeInstance) {
      settings.set(key, value);
    } else {
      memorySettings[key] = value;
    }
  }

  function get(key) {
    if(activeInstance) {
      return settings.get(key);
    } else {
      return memorySettings[key];
    }
  }

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
    get,
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
    set,
    setBlnUrl: function(url) {
      var apiUrl = url + (env.apiPath || '/api/v1');
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
      if(!env.auth || !env.auth.secretStorage || env.auth.secretStorage === 'keytar') {
        if(type === undefined) return Promise.resolve();
        return keytar.deletePassword('balloon', type);
      } else if(env.auth.secretStorage === 'config') {
        set(type, undefined);
        return Promise.resolve();
      }
    },
    storeSecret: function(type, key) {
      secret = key;
      traySecretUpdate();

      if(!env.auth || !env.auth.secretStorage || env.auth.secretStorage === 'keytar') {
        return keytar.setPassword('balloon', type, key);
      } else if(env.auth.secretStorage === 'config') {
        set(type, key);
        return Promise.resolve();
      }
    },
    retrieveSecret: function(type) {
      if(!env.auth || !env.auth.secretStorage || env.auth.secretStorage === 'keytar') {
        return keytar.getPassword('balloon', type);
      } else if(env.auth.secretStorage === 'config') {
        return Promise.resolve(get(type));
      }
    },
    setTraySecretCallback: function(callee) {
      traySecretUpdate = callee;
    },
    updateTraySecret: function() {
      traySecretUpdate();
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

    /**
     * @var string||array id node id(s) to uningore
     */
    unignoreNode: function(id) {
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

      ignoreNodes = ignoreNodes.filter(node => {
        return id.indexOf(node) === -1;
      });

      ignoreNodes = [...new Set(ignoreNodes)];

      settings.set('ignoreNodes', ignoreNodes);
    },
  }
}();
