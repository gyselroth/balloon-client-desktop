const fs = require('fs');
const path = require('path');

const {app} = require('electron');
const appMigrations = require('app-migrations');

const globalConfig = require('./global-config.js');
const clientConfig = require('./config.js');
const logger = require('./logger.js');


function readMigrations(callback) {
  const migrationsPath = path.join(__dirname, '../migrations');
  const migrations = {};

  fs.readdir(migrationsPath, (err, nodes) => {
    if(err) return callback(err);

    try {
      nodes.forEach(function(node) {
        let matches = node.match(/^v([0-9]+\.[0-9]+\.[0-9]+)\.js$/);
        if (matches !== null) {
          migrations[matches[1]] = require(path.join(migrationsPath, node));
        }
      });
    } catch(err) {
      return callback(err);
    }

    callback(null, migrations);
  });
}

module.exports = function migrate() {
  let previousVersion = globalConfig.get('version');
  const currentVersion = app.getVersion();

  logger.info('Checking for migration');

  if(previousVersion === undefined) {
    const instanceDir = clientConfig.get('instanceDir');

    if(instanceDir) {
      //instanceDir exists in config, so this must be an update
      //default previousVersion to 0.0.28 which is the version before migrations have been implemented
      previousVersion ='0.0.28';
    } else {
      logger.info('Previous version not set, assuming fresh install. No migration will run');
      globalConfig.set('version', currentVersion);
      return Promise.resolve();
    }
  }

  if(previousVersion === currentVersion) {
    logger.info('No migration necessary as previous and current Version are equal');
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    readMigrations((err, migrations) => {
      if(err) return reject(err);

      logger.info(`Migrating from ${previousVersion} to ${currentVersion}`);
      appMigrations(migrations)(previousVersion, currentVersion, (err, result) => {
        if(err) {
          logger.error(`Migrating from ${previousVersion} to ${currentVersion} failed`, {err})
          return reject(err);
        }

        logger.info(`Migration from ${previousVersion} to ${currentVersion} successfull`);

        globalConfig.set('version', currentVersion);
        resolve(result);
      });
    });
  });
}
