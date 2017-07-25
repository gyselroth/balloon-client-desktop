const fs = require('graceful-fs');
const path = require('path');
const childProcess = require('child_process');

const electron = require('electron');
const settings = require('electron-settings');
const app = electron.app || electron.remote.app;

const env = require('../env.js');
const fsUtility = require('./fs-utility.js');

function initialize() {
  var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
  var configDirName = env.configDirName || '.balloon';

  var configDir = path.join(homeDir, configDirName);

  var configFile = path.join(configDir, env.configFileName || 'config.json');
  var balloonDir = path.join(homeDir, env.balloonDirName || 'Balloon');

  if(!fs.existsSync(configDir)) {
    fsUtility.mkdirpSync(configDir);

    if(process.platform === 'win32') {
      //"Hide" configDir on win32
      childProcess.execSync('ATTRIB +H ' + configDir);
    }
  }

  settings.setPath(configFile);

  var newSettigns = settings.getAll();

  newSettigns.version = app.getVersion();
  newSettigns.configDir = configDir;
  newSettigns.configFile = configFile;
  newSettigns.homeDir = homeDir;
  newSettigns.balloonDir = balloonDir;

  if(!newSettigns.blnUrl) newSettigns.blnUrl = env.blnUrl;
  if(!newSettigns.apiPath) newSettigns.apiPath = (env.apiPath || '/api/v1/');
  if(!newSettigns.apiUrl) newSettigns.apiUrl = env.blnUrl + newSettigns.apiPath;
  if(!newSettigns.ignoreNodes) newSettigns.ignoreNodes = [];

  newSettigns.context = env.name || 'production';
  newSettigns.maxConcurentConnections = env.sync && env.sync.maxConcurentConnections ? env.sync.maxConcurentConnections : 20;

  if(newSettigns.loggedin === undefined) {
    newSettigns.loggedin = false;
  }

  if(newSettigns.disableAutoAuth === undefined) {
    newSettigns.disableAutoAuth = false;
  }

  settings.setAll(newSettigns);
}

module.exports = function() {
  initialize();

  return {
    getAll: function() {
      return settings.getAll();
    },
    get: function(key) {
      return settings.get(key);
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
      settings.set(key, value);
    },
    setBlnUrl: function(url) {
      var apiUrl = url + settings.get('apiPath');

      settings.set('blnUrl', url);
      settings.set('apiUrl', apiUrl);
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

      ignoreNodes = ignoreNodes.concat(id);

      ignoreNodes = [...new Set(ignoreNodes)];

      settings.set('ignoreNodes', ignoreNodes);
    },

    initialize
  }
}();
