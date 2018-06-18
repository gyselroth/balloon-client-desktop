const fs = require('graceful-fs');
const path = require('path');

const async = require('async');

const logger = require('../logger.js');
const fsUtility = require('../fs-utility.js');

module.exports = function(clientConfig) {
  const instanceDir = clientConfig.get('instanceDir');

  function resetCursorAndDb() {
    logger.debug('reseting cursor and sync db initalized',  {category: 'config-manager'});

    return new Promise(function(resolve, reject) {
      async.parallel([
        resetLastCursor,
        resetSyncDb,
        resetQueueErrorDb,
        resetTransferDb
      ], (err, results) => {
        if(err) {
          logger.error('reset cursor and sync db failed', {
            category: 'config-manager',
            error: err
          });
          reject(err);
        } else {
          logger.debug('reset cursor and sync db was successfull', {category: 'config-manager'});
          resolve();
        }
      });
    });
  }

  function resetLastCursor(callback) {
    if(!instanceDir) {
      return callback(null)
    }

    fs.unlink(path.join(instanceDir, 'last-cursor'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  function resetSyncDb(callback) {
    if(!instanceDir) {
      return callback(null)
    }

    fs.unlink(path.join(instanceDir, 'db/nodes.db'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  function resetQueueErrorDb(callback) {
    if(!instanceDir) {
      return callback(null)
    }

    fs.unlink(path.join(instanceDir, 'db/api-error-queue.db'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  function resetTransferDb(callback) {
    if(!instanceDir) {
      return callback(null)
    }

    fs.unlink(path.join(instanceDir, 'db/transfer.db'), (err) => {
      if(err && err.code !== 'ENOENT') {
        logger.error(err);
        return callback(err);
      }

      callback(null);
    });
  }

  return {
    resetCursorAndDb
  }
}
