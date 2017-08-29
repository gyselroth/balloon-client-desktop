const fs = require('graceful-fs');
const path = require('path');
const settings = require('electron-settings');
const env = require('../env.js');
const fsUtility = require('./fs-utility.js');
const logger = require('./logger.js')

var instances = {};
var instancesFile;

function initialize() {
  var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
  var configDir;

  if(env.configDir) {
    configDir = env.configDir.replace('{HOME}', homeDir);
  } else {
    configDir = path.join(homeDir, '.balloon');
  }

  instancesFile = path.join(configDir, 'instances.json');

  if(!fs.existsSync(instancesFile)) {
    instances = {};
  } else {
    instances = JSON.parse(fs.readFileSync(instancesFile, 'utf8'));
    //require() does caching?
    //instances = require(instancesFile);
  }
}

function persist() {
  if(fs.existsSync(instancesFile)) {
    fs.truncateSync(instancesFile, 0);
  }

  fs.writeFileSync(instancesFile, JSON.stringify(instances, null, 2));
}

module.exports = function() {
  initialize();

  function archiveDataDir(clientConfig) {
    return new Promise(function(resolve, reject) {
      var instance = instances.lastActive;
      if(!instance) {
        logger.info('INSTANCE: nothing to archive');
        resolve();
      }

      logger.info('INSTANCE: archiveDataDir initialized');

      var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
      var balloonDirsyncStateArchivePath;
      var versionNumber = 0;
      var versionString = '';

      while(true) {
        if(versionNumber > 0) versionString = '-' + versionNumber;

        var balloonDirsyncStateArchivePath = path.join(homeDir, 'Balloon-' + instances.instances[instance].username + versionString);

        if(!fs.existsSync(balloonDirsyncStateArchivePath)) break;

        versionNumber++;
      }

      fs.rename(clientConfig.get('balloonDir'), balloonDirsyncStateArchivePath, (err) => {
        if(err) return reject(err);

        logger.info('INSTANCE: archiveDataDir finished', {balloonDirsyncStateArchivePath});

        instances.instances[instance].balloonDir = balloonDirsyncStateArchivePath;
        instances.instances[instance].balloonDirIno = fs.lstatSync(balloonDirsyncStateArchivePath).ino;
        persist();
        resolve();
      });
    });
  }
    
  function createDataDir(balloonDir, homeDir) {
    return new Promise(function(resolve, reject) {
      fsUtility.createBalloonDir(balloonDir, homeDir, (err) => {
        if(err) return reject(err);

        logger.info('INSTANCE: createDataDir finished');
        resolve();
      });
    });
  }

  function unarchiveDataDir(archiveDir, balloonDir, homeDir) {
    logger.info('INSTANCE: unarchiveBalloonDir initialized', {archiveDir});

    return new Promise(function(resolve, reject) {
      if(fs.existsSync(archiveDir) === false) return createDataDir(balloonDir, homeDir)

      fs.rename(archiveDir, balloonDir, (err) => {
        if(err) return reject(err);

        logger.info('INSTANCE: unarchiveDataDir finished', {balloonDir});
        resolve();
      });
    });
  }

  function getNewInstanceName() {
    var versionString = 'instance-';
    var versionNumber = 1;
    var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
    var configDirName = env.configDirName || '.balloon';
    var instancePath;
      
    while(true) {
      var instancePath = path.join(homeDir, configDirName, versionString + versionNumber);
      
      if(!fs.existsSync(instancePath)) {
        return versionString + versionNumber;
      } 
      versionNumber++;
    }
  }

  return {
    initialize,
    getInstances: function() {
      return instances.instances;
    },
    getLastActiveInstance: function() {
      return instances.lastActive;
    },
    getActiveInstance: function() {
      return instances.active;
    },
    getInstance: function(clientConfig) {
      if(instances.instances) {
        for(instance in instances.instances) {
          if(instances.instances[instance].server === clientConfig.get('blnUrl') 
           && instances.instances[instance].username === clientConfig.get('username')) {
            return instance;
          }
        }
      }

      return null;
    },
    archiveDataDir,
    loadInstance: function(name, clientConfig) {
      var switchInstance = function() {
        instances.active = name;
        instances.instances[instance].balloonDir = undefined;
        instances.instances[instance].balloonDirIno = undefined;
        persist(); 
        clientConfig.initialize();
      };

      return new Promise(function(resolve, reject) {
        var instance = instances.instances[name];
        if(fs.existsSync(instance.balloonDir)) {
          unarchiveDataDir(instance.balloonDir, clientConfig.get('balloonDir'), clientConfig.get('homeDir')).then(() => {
            switchInstance();
            resolve();
          }).catch(reject);
        } else {
          if(fs.existsSync(clientConfig.get('balloonDir')) === false) {
            createDataDir(clientConfig.get('balloonDir'), clientConfig.get('homeDir')).then(() => {
              switchInstance();
              resolve();
            }).catch(reject);
          } else {
            switchInstance();
            resolve();
          }
        }
      });
    },
    setNewInstance: function(clientConfig) {
      if(!instances.instances) {
        instances.instances = {};
      } 
      
      var name = getNewInstanceName();
      instances.instances[name] = {
        server: clientConfig.get('blnUrl'),
        username: clientConfig.get('username')
      };

      instances.active = name;
      persist();
      clientConfig.initialize();
    },
    unlink: function(clientConfig){
      instances.lastActive = instances.active;
      instances.active = undefined;
      persist();
      clientConfig.initialize();
    }
  }
}();
