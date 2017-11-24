const fs = require('fs');
const path = require('path');

const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');

module.exports = function(previousVersion, currentVersion, done) {
  logger.info('Running migraton to 0.0.29', {category: 'migration'});

  if(/^win/.test(process.platform) === false) {
    logger.info('Migration to 0.0.29: not windows, no migration necessary', {category: 'migration'});
    return done(null, 'Not on windows, nothing to do');
  }

  const instancesFile = paths.getInstancesFile();
  if(!fs.existsSync(instancesFile)) {
    logger.info('Migration to 0.0.29: no instances, no migration necessary', {category: 'migration'});
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
          const pLastCursor = path.join(instanceDir, 'last-cursor');
          if(fs.existsSync(pLastCursor)) {
            fs.unlinkSync(pLastCursor);
          }

          const pNodesDb = path.join(instanceDir, 'db/nodes.db');
          if(fs.existsSync(pNodesDb)) {
            fs.unlinkSync(pNodesDb);
          }

          const pErrorQueueDb = path.join(instanceDir, 'db/api-error-queue.db');
          if(fs.existsSync(pErrorQueueDb)) {
            fs.unlinkSync(pErrorQueueDb);
          }

          const pTransferDb = path.join(instanceDir, 'db/transfer.db');
          if(fs.existsSync(pTransferDb)) {
            fs.unlinkSync(pTransferDb);
          }
        }
      });
    }

    done(null, 'Removed cursor and sync db');
  } catch(err) {
    logger.error('failed migrate to 0.0.29', {
      category: 'migration',
      error: err
    });

    done(err);
  }
}
