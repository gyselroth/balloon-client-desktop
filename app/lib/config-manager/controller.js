const fs = require('graceful-fs');
const path = require('path');

const async = require('async');

const logger = require('../logger.js');
const fsUtility = require('../fs-utility.js');

module.exports = function(clientConfig) {
  const instanceDir = clientConfig.get('instanceDir');

  function reset() {
    logger.debug('Reset initalized');

    return new Promise(function(resolve, reject) {
      async.parallel([
        resetLastCursor,
        resetSyncDb,
        resetQueueErrorDb,
        resetTransferDb,
        removeLocalFiles
      ], (err, results) => {
        if(err) {
          logger.error('Reset failed', err);
          reject(err);
        } else {
          logger.debug('Reset successfull');
          resolve();
        }
      });
    });
  }

  function resetCursorAndDb() {
    logger.debug('resetCursorAndDb initalized');

    return new Promise(function(resolve, reject) {
      async.parallel([
        resetLastCursor,
        resetSyncDb,
        resetQueueErrorDb,
        resetTransferDb
      ], (err, results) => {
        if(err) {
          logger.error('resetCursorAndDb failed', err);
          reject(err);
        } else {
          logger.debug('resetCursorAndDb successfull');
          resolve();
        }
      });
    });
  }

  function removeLocalFiles(callback) {
    var pathBalloonDir = clientConfig.get('balloonDir');
    async.series([
      (cb) => {
        fsUtility.rmdirp(pathBalloonDir, cb);
      },
      (cb) => {
        fsUtility.createBalloonDir(pathBalloonDir, cb);
      }
    ], (err) => {
      if(err) {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  function resetLastCursor(callback) {
    fs.unlink(path.join(instanceDir, 'last-cursor'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  function resetSyncDb(callback) {
    fs.unlink(path.join(instanceDir, 'db/nodes.db'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  function resetQueueErrorDb(callback) {
    fs.unlink(path.join(instanceDir, 'db/api-error-queue.db'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  function resetTransferDb(callback) {
    fs.unlink(path.join(instanceDir, 'db/transfer.db'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  return {
    reset,
    resetCursorAndDb
  }
}
