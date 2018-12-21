const fs = require('fs');
const path = require('path');

const async = require('async');
const ElectronSettings = require('electron-settings/lib/settings.js');
const nedb = require('nedb');

const env = require('../env.js');
const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');
const fsUtility = require('../lib/fs-utility.js');

module.exports = function(previousVersion, currentVersion, done) {
  const migrationVersion = '1.0.0-beta4';
  logger.info(`Running migraton to ${migrationVersion}`, {category: 'migration'});

  const instancesFile = paths.getInstancesFile();

  if(!fs.existsSync(instancesFile)) {
    logger.info(`Migration to ${migrationVersion}: no instances file, no migration necessary`, {category: 'migration'});
    return done(null, 'no instances, nothing to do.');
  }

  function handleError(err) {
    logger.error(`failed migrate to ${migrationVersion}`, {
      category: 'migration',
      error: err
    });

    done(err);
  }

  try {
    const instancesConfig = JSON.parse(fs.readFileSync(instancesFile, 'utf8'));
    const instances = instancesConfig.instances;

    if(instances) {
      const instanceNames = Object.keys(instances);

      if(!instanceNames || instanceNames.length === 0) {
        logger.info(`Migration to ${migrationVersion}: no instances, no migration necessary`, {category: 'migration'});
        return done(null, 'no instances, nothing to do.');
      }

      async.map(instanceNames, (instanceName, cb) => {
        const instanceDir = paths.getInstanceDir(instanceName);

        if(!fs.existsSync(instanceDir)) return cb();

        const configFile = path.join(instanceDir, (env.configFileName || 'config-'+env.name+'.json'));

        const settings = new ElectronSettings();

        settings.setPath(configFile);

        const pathBalloonDirInoStorage = path.join(instanceDir, 'balloon-dir-ino');
        if(fs.existsSync(pathBalloonDirInoStorage) === false) {
          let balloonDir;
          var instance = instances[instanceName];
          if (instance.balloonDirIno) {
            try {
              fs.writeFileSync(pathBalloonDirInoStorage, instance.balloonDirIno);
            } catch(err) {
              cb(err);
            }
          } else {
            balloonDir = settings.get('balloonDir');

            try {
              const ino = fs.lstatSync(balloonDir).ino;
              fs.writeFileSync(pathBalloonDirInoStorage, ino);
            } catch(err) {
              cb(err);
            }
          }

          cb(null);
        }

      }, err => {
        if(err) return handleError(err);

        done(null, 'migrated balloonDirIno');
      });
    }
  } catch(err) {
    handleError(err);
  }
}
