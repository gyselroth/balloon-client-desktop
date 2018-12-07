const fs = require('graceful-fs');
const path = require('path');
const settings = require('electron-settings');
const env = require('../env.js');
const fsUtility = require('./fs-utility.js');
const logger = require('./logger.js');
const paths = require('./paths.js');
const configManagerCtrl = require('./config-manager/controller.js');

var instances = {};
var instancesFile;

function initialize() {
  instancesFile = paths.getInstancesFile();

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
        logger.debug('nothing to archive', {category: 'instance'});
        resolve();
      }

      logger.info('archive current data directory', {category: 'instance'});

      var balloonDir = clientConfig.get('balloonDir');
      var balloonDirsyncStateArchivePath;
      var versionNumber = 0;
      var versionString = '';

      while(true) {
        if(versionNumber > 0) versionString = '-' + versionNumber;

        var balloonDirsyncStateArchivePath = balloonDir+'-'+instances.instances[instance].username + versionString;

        if(!fs.existsSync(balloonDirsyncStateArchivePath)) break;

        versionNumber++;
      }

      fs.rename(balloonDir, balloonDirsyncStateArchivePath, (err) => {
        if(err) return reject(err);

        logger.info('successfully archived data directory', {
          category: 'instance',
          archive: balloonDirsyncStateArchivePath
        });

        instances.instances[instance].balloonDir = balloonDirsyncStateArchivePath;
        instances.instances[instance].balloonDirIno = fs.lstatSync(balloonDirsyncStateArchivePath).ino;
        persist();
        resolve();
      });
    });
  }

  function createDataDir(clientConfig, instanceName) {

    var configManager = configManagerCtrl(clientConfig, paths.getInstanceDir(instanceName));

    var createDirP = new Promise(function(resolve, reject) {
      fsUtility.createBalloonDir(clientConfig.get('balloonDir'), clientConfig.get('homeDir'), (err) => {
        if(err) return reject(err);

        logger.info('data directory has been created', {category: 'instance'});
        resolve();
      });
    });

    //if data dir is being created sync state has to be reset
    return Promise.all([
      createDirP,
      configManager.resetCursorAndDb(),
    ]);
  }

  function unarchiveDataDir(archiveDir, clientConfig, instanceName) {
    logger.info('starting to extract archived data directory', {
      category: 'instance',
      archive: archiveDir
    });

    return new Promise(function(resolve, reject) {
      if(fs.existsSync(archiveDir) === false) return createDataDir(clientConfig, instanceName);

      var balloonDir = clientConfig.get('balloonDir');
      fs.rename(archiveDir, balloonDir, (err) => {
        if(err) return reject(err);

        logger.info('successfully extracted archived data dir', {
          category: 'instance',
          archive: balloonDir
        });
        resolve();
      });
    });
  }

  function getNewInstanceName() {
    var configDir = paths.getConfigDir();
    var versionString = 'instance-';
    var versionNumber = 1;
    var instancePath;

    while(true) {
      var instancePath = path.join(configDir, versionString + versionNumber);

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
    getInstanceByName: function(name) {
      return instances.instances[name];
    },
    getInstance: function(clientConfig) {
      if(instances.instances) {
        for(instance in instances.instances) {
          if(
            instances.instances[instance].server === clientConfig.get('blnUrl')
            &&
            instances.instances[instance].username === clientConfig.get('username')
            &&
            instances.instances[instance].context === clientConfig.get('context')
          ) {
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
        instances.instances[name].balloonDir = undefined;
        instances.instances[name].balloonDirIno = undefined;
        persist();
        clientConfig.initialize();
      };

      return new Promise(function(resolve, reject) {
        var instance = instances.instances[name];

        if(fs.existsSync(instance.balloonDir)) {
          unarchiveDataDir(instance.balloonDir, clientConfig, name).then(() => {
            switchInstance();
            resolve();
          }).catch(reject);
        } else {
          if(fs.existsSync(clientConfig.get('balloonDir')) === false) {
              createDataDir(clientConfig, name).then(() => {
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
        username: clientConfig.get('username'),
        context: clientConfig.get('context')
      };

      instances.active = name;
      persist();
      clientConfig.initialize();

      return createDataDir(clientConfig, name);
    },
    unlink: function(clientConfig){
      instances.lastActive = instances.active;
      instances.active = undefined;
      persist();
      clientConfig.initialize();
    }
  }
}();
