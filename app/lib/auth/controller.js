const fs = require('graceful-fs');
const path = require('path');

const {session} = require('electron');

const OauthCtrl = require('../../ui/oauth/controller.js');
const logger = require('../logger.js');
const fsUtility = require('../fs-utility.js');

var syncArchiveSatesFactory = function(clientConfig) {
  var states;
  var statesFile;
  var archiveDir;

  function initialize(clientConfig) {
    archiveDir = path.join(clientConfig.get('configDir'), 'syncStatesArchive');
    statesFile = path.join(archiveDir, 'states.json');


    if(!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir);
    }

    if(!fs.existsSync(statesFile)) {
      states = {};
    } else {
      states = require(statesFile);
    }

    persist();
  }

  function persist() {
    if(fs.existsSync(statesFile)) {
      fs.truncateSync(statesFile, 0);
    }

    fs.writeFileSync(statesFile, JSON.stringify(states, null, 2));
  }

  initialize(clientConfig);

  return {
    getArchiveDir: function() {
      return archiveDir
    },
    get: function(key) {
      return states[key];
    },
    set: function(key, value) {
      states[key] = value;
      persist();
    }
  }
}

module.exports = function(env, clientConfig) {
  var oauth = OauthCtrl(env, clientConfig);

  function hasAccessToken() {
    return clientConfig.get('accessToken') !== undefined;
  }

  function accessTokenExpired() {
    //if no token is set, or token expires in less then 60 seconds: token is expired
    return clientConfig.get('accessTokenExpires') !== undefined && clientConfig.get('accessTokenExpires') < (Date.now() / 1000 + 60);
  }

  function logout() {
    logger.info('AUTH: logout initialized');

    return new Promise(function(resolve, reject) {
      var oldAccessToken = clientConfig.get('accessToken');

      Promise.all([
        oauth.revokeToken(oldAccessToken).then(resolve),
        new Promise(function(resolve, reject) {
          session.fromPartition('persist:oauth').clearStorageData({storages: ['cookies']}, () => {
            resolve();
          });
        }),
        new Promise(function(resolve, reject) {
          clientConfig.setMulti({
            'loggedin': false,
            'accessToken': undefined,
            'accessTokenExpires': undefined
          });

          resolve();
        })
      ]).then(resolve).catch(reject);
    });
  }

  function login() {
    logger.info('AUTH: login initialized');

    var oldUser = clientConfig.get('username');

    return new Promise(function (resolve, reject) {
      oauth.generateAccessToken().then((result) => {
        clientConfig.set('loggedin', true);

        logger.info('AUTH: user logged in', {result, oldUser});
        if(oldUser !== undefined && result.username !== undefined && result.username !== oldUser) {
          var currentUser = result.username;
          logger.info('AUTH: a new user logged in switching sync state', {oldUser, currentUser});

          switchSyncState(oldUser, currentUser).then(() => {
            resolve(result);
          }).catch((err) => {
            logger.error('AUTH: switching sync state had an error', err);

            logout().then(function() {
              clientConfig.set('username', oldUser);
              clientConfig.set('loggedin', false);
              reject(err);
            }).catch(err => {
              clientConfig.setMulti({
                'username': oldUser,
                'loggedin': false
              });
              reject(err);
            });
          });
        } else {
          resolve(result);
        }
      }).catch(err => {
        logger.error('Auth: generateAccessToken failed', err);

        clientConfig.set('loggedin', false);

        reject(err);
      });
    });
  }

  function switchSyncState(oldUser, currentUser) {
    var syncArchiveStates = syncArchiveSatesFactory(clientConfig);

    return new Promise(function(resolve, reject) {
      archiveCurrentState(oldUser).then(() => {
        initializeSyncState(currentUser, resolve, reject);
      }).catch(reject);
    });

    function archiveCurrentState(username) {
      return new Promise(function(resolve, reject) {
        Promise.all([
          archiveBalloonDir(username),
          archiveSyncState(username)
        ]).then((results) => {
          var balloonDirPath = results[0];
          var syncStatePath = results[1];
          var balloonDirIno = fs.lstatSync(balloonDirPath).ino;
          var syncStateIno = fs.lstatSync(syncStatePath).ino;

          syncArchiveStates.set(username, {
            balloonDirPath,
            balloonDirIno,
            syncStatePath,
            syncStateIno
          });

          resolve(results);
        }).catch(function(err) {
          reject(err);
        });
      });
    }

    function archiveBalloonDir(username) {
      return new Promise(function(resolve, reject) {
        logger.info('AUTH: archiveBalloonDir initialized', {username});

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

          logger.info('AUTH: archiveBalloonDir finished', {balloonDirsyncStateArchivePath});
          resolve(balloonDirsyncStateArchivePath);
        });
      });
    }

    function archiveSyncState(username) {
      logger.info('AUTH: archiveSyncState initialized', {username});

      return new Promise(function(resolve, reject) {
        var syncStateArchiveDirPath = syncArchiveStates.getArchiveDir();

        var syncStateArchivePath;
        var versionNumber = 0;
        var versionString = '';

        while(true) {
          if(versionNumber > 0) versionString = '-' + versionNumber;

          syncStateArchivePath = path.join(syncStateArchiveDirPath, username + versionString);
          if(!fs.existsSync(syncStateArchivePath)) break;

          versionNumber++;
        }

        try {
          fs.mkdirSync(syncStateArchivePath);
        } catch(err) {
          reject(err);
        }

        Promise.all([
          new Promise(function(resolve, reject) {
            var newDbPath = path.join(syncStateArchivePath, 'db');
            var oldDbPath = path.join(clientConfig.get('configDir'), 'db');

            if(fs.existsSync(oldDbPath) === false) return resolve();

            fs.rename(oldDbPath, newDbPath, (err) => {
              if(err) return reject(err);

              resolve();
            });
          }),
          new Promise(function(resolve, reject) {
            var newCursorPath = path.join(syncStateArchivePath, 'last-cursor');
            var oldCursorPath = path.join(clientConfig.get('configDir'), 'last-cursor');

            if(fs.existsSync(oldCursorPath) === false) return resolve();

            fs.rename(oldCursorPath, newCursorPath, (err) => {
              if(err) return reject(err);

              resolve();
            });
          })
        ]).then(function() {
          logger.info('AUTH: archiveSyncState finished', {syncStateArchivePath});

          resolve(syncStateArchivePath);
        }).catch((err) => {
          logger.error('AUTH: archiveSyncState failed', err);

          reject(err);
        });
      });
    }

    function initializeSyncState(username, resolve, reject) {
      logger.info('AUTH: initializeSyncState initialized', {username});
      var existingState = syncArchiveStates.get(username);

      if(existingState && fs.existsSync(existingState.balloonDirPath) && fs.existsSync(existingState.syncStatePath)) {
        Promise.all([
          unarchiveBalloonDir(existingState),
          unarchiveSyncDb(existingState),
          unarchiveLastCursor(existingState)
        ]).then(() => {
          var syncStatePath = existingState.syncStatePath;

          syncArchiveStates.set(username, undefined);

          fsUtility.rmdirp(syncStatePath, err => {
            resolve();
          });
        }).catch(reject);
      } else {
        createBalloonDir(resolve, reject);
      }
    }

    function createBalloonDir(resolve, reject) {
      fsUtility.createBalloonDir(clientConfig.get('balloonDir'), (err) => {
        if(err) return reject(err);

        logger.info('AUTH: initializeSyncState finished');

        resolve();
      });
    }

    function unarchiveBalloonDir(existingState) {
      logger.info('AUTH: unarchiveBalloonDir initialized', {existingState});

      return new Promise(function(resolve, reject) {
        if(fs.existsSync(existingState.balloonDirPath) === false) return createBalloonDir(resolve, reject);

        fs.rename(existingState.balloonDirPath, clientConfig.get('balloonDir'), (err) => {
          if(err) return reject(err);

          logger.info('AUTH: unarchiveBalloonDir finished', {balloonDir: clientConfig.get('balloonDir')});

          resolve();
        });
      });
    }

    function unarchiveSyncDb(existingState) {
      logger.info('AUTH: unarchiveSyncDb initialized', {existingState});

      return new Promise(function(resolve, reject) {
        var srcPath = path.join(existingState.syncStatePath, 'db');
        var targetPath = path.join(clientConfig.get('configDir'), 'db');

        if(fs.existsSync(srcPath) === false) {
          fsUtility.mkdirp(targetPath);
        } else {
          fs.rename(srcPath, targetPath, (err) => {
            if(err) return reject(err);

            logger.info('AUTH: unarchiveSyncDb finished', {targetPath});

            resolve();
          });
        }
      });
    }

    function unarchiveLastCursor(existingState) {
      logger.info('AUTH: unarchiveLastCursor initialized', {existingState});

      return new Promise(function(resolve, reject) {
        var srcPath = path.join(existingState.syncStatePath, 'last-cursor');
        var targetPath = path.join(clientConfig.get('configDir'), 'last-cursor');

        if(fs.existsSync(srcPath) === false) return resolve();

        fs.rename(srcPath, targetPath, (err) => {
          if(err) return reject(err);

          logger.info('AUTH: unarchiveLastCursor finished', {targetPath});

          resolve();
        });
      });
    }
  }

  return {
    logout,
    login,
    hasAccessToken,
    accessTokenExpired
  }
}
