const fs = require('fs');
const path = require('path');

const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');
const fsUtility = require('../lib/fs-utility.js');

module.exports = function(previousVersion, currentVersion, done) {
  logger.info('Running migraton to 0.0.40', {category: 'migration'});

  const instancesFile = paths.getInstancesFile();

  if(!fs.existsSync(instancesFile)) {
    logger.info('Migration to 0.0.40: no instances, no migration necessary', {category: 'migration'});
    return done(null, 'No instances, nothing to do.');
  }

  try {
    const instancesConfig = JSON.parse(fs.readFileSync(instancesFile, 'utf8'));
    const instances = instancesConfig.instances;

    if(instances) {
      const instanceNames = Object.keys(instances);

      instanceNames.forEach((instanceName) => {
        const instanceDir = paths.getInstanceDir(instanceName);

        if(fs.existsSync(instanceDir)) {
          const pRemoteDeltaLogDb = path.join(instanceDir, 'db/remotedelta-log.db');
          if(fs.existsSync(pRemoteDeltaLogDb)) {
            fs.unlinkSync(pRemoteDeltaLogDb);
          }
        }
      });
    }

    done(null, 'Removed remote delta log db');
  } catch(err) {
    logger.error('failed migrate to 0.0.40', {
      category: 'migration',
      error: err
    });

    done(err);
  }
}
