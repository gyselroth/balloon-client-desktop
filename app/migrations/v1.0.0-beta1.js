const fs = require('fs');
const env = require('../env.js');
const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');
const fsUtility = require('../lib/fs-utility.js');
const instanceManager = require('../lib/instance.js');

module.exports = function(previousVersion, currentVersion, done) {
  const migrationVersion = '1.0.0-beta1';
  logger.info(`running migraton to ${migrationVersion}`, {category: 'migration'});

  function handleError(err) {
    logger.error(`failed migrate to ${migrationVersion}`, {
      category: 'migration',
      error: err
    });

    done(err);
  }

  const instancesFile = paths.getInstancesFile();

  if(!fs.existsSync(instancesFile)) {
    logger.info(`migration to ${migrationVersion}: no instances file, no migration necessary`, {category: 'migration'});
    return done(null, 'no instances, nothing to do.');
  }

  try {
    const instancesConfig = JSON.parse(fs.readFileSync(instancesFile, 'utf8'));
    const instances = instancesConfig.instances;

    if(instances) {
      for(let instance in instances) {
        if(!instances[instance].context) {
          instances[instance].context = env.name;
        }
      }

      fs.writeFileSync(instancesFile, JSON.stringify(instancesConfig, null, 2));
      instanceManager.initialize();
      var active = instancesConfig.active;

      if(active && instances[active].balloonDir) {
        Promise.all([
          fsUtility.setDirIcon(instances[active].balloonDir),
          fsUtility.setDirShortcut(instances[active].balloonDir),
        ]).then(() => {
          done(null, 'ensure folder sidebar/icon');
        }).catch((error) => {
          handleError(error);
        });
      } else {
        done(null, 'no active instance, nothing to do.');
      }
    }
  } catch(err) {
    handleError(err);
  }
}
