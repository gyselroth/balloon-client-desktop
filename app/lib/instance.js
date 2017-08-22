const fs = require('graceful-fs');
const path = require('path');
const settings = require('electron-settings');
const env = require('../env.js');
const fsUtility = require('./fs-utility.js');
const logger = require('./logger.js')

//module.exports = function() {
var instances = {};
var instancesFile;

function initialize() {
  var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
  var configDirName = env.configDirName || '.balloon';
  instancesFile = path.join(homeDir, configDirName, 'instances.json');

  if(!fs.existsSync(instancesFile)) {
    instances = {};
  } else {
    instances = require(instancesFile);
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
console.log("ALERT . 1");
    return new Promise(function(resolve, reject) {
console.log("ALERT . 2");
      var instance = instances.lastActive;
      if(!instance) {
        logger.info('INSTANCE: nothing to archive');
        resolve();
      }

      var username = clientConfig.get('username');
console.log("ALERT . 3", instance);
console.log(instance.instances);
      logger.info('AUTH: archiveDataDir initialized', {username});

      var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
      var balloonDirsyncStateArchivePath;
      var versionNumber = 0;
      var versionString = '';

      while(true) {
        if(versionNumber > 0) versionString = '-' + versionNumber;

        var balloonDirsyncStateArchivePath = path.join(homeDir, 'BalloonDir-' + username + versionString);

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
    
  function createDataDir(balloonDir) {
    return new Promise(function(resolve, reject) {
      fsUtility.createBalloonDir(balloonDir, (err) => {
        if(err) return reject(err);

        logger.info('INSTANCE: createDataDir finished');
        resolve();
      });
    });
  }

  function unarchiveDataDir(archiveDir, balloonDir) {
    logger.info('INSTANCE: unarchiveBalloonDir initialized', {archiveDir});

    return new Promise(function(resolve, reject) {
      if(fs.existsSync(path) === false) return createDataDir(balloonDir)

      fs.rename(archiveDir, balloonDir, (err) => {
        if(err) return reject(err);

        logger.info('INSTANCE: unarchiveDataDir finished', {balloonDir});
        resolve();
      });
    });
  }

  function getActiveInstance() {
    if(instances.active) {
      return instances.active;
    } else {
      return 'instance-1';
    }
  }
  
  function getLastActiveInstance() {
    if(instances.lastActive) {
      return instances.lastActive;
    }
  
    return null;
  }

  function getNewInstanceName() {
console.log("getNewInstanceName");
      var versionString = 'instance-';
      var versionNumber = 1;
      var homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
      var configDirName = env.configDirName || '.balloon';
      var instancePath;
      
      while(true) {
        var instancePath = path.join(homeDir, configDirName, versionString + versionNumber);
        console.log(instancePath);
        if(!fs.existsSync(instancePath)) {
          return versionString + versionNumber;
        } else {
            console.log("aa");
        }
        versionNumber++;
      }
  }

  return {
    getInstances: function() {
      return instances.instances;
    },
    getLastActiveInstance,
    getActiveInstance,
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
    getInstanceByName: function(name) {
      
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
        if(fs.existsSync(instance.balloonDirPath)) {
          unarchiveBalloonDir(instance.balloonDirPath, clientConfig.get('balloonDir')).then(() => {
            switchInstance();
            resolve();
          }).catch(reject);
        } else {
          if(fs.existsSync(clientConfig.get('balloonDir')) === false) {
            createDataDir(clientConfig.get('balloonDir')).then(() => {
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

      instances.instances[getActiveInstance()] = {
        server: clientConfig.get('blnUrl'),
        username: clientConfig.get('username')
      };

      instances.active = getActiveInstance();
      persist();
    },
    unlink: function(clientConfig){
      instances.lastActive = getActiveInstance()
      /*var name;
      if(instances.active) {
        var nr = parseInt(getActiveInstance().split('-')[1]);
        ++nr;
        name = 'instance-'+nr;
      } else {
        instances.active = 'instance-1';
      }*/

      instances.active = getNewInstanceName();
      persist();
      clientConfig.initialize();
    }
  }
}();
