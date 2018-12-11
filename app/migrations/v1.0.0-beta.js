const instance = require('../lib/instance.js');

const env = require('../env.js');
const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');
const fsUtility = require('../lib/fs-utility.js');

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

  try {
    var instance = instances.getInstances(instances.getActiveInstance());

    if(instance && instance.balloonDir) {
      fsUtility.

      Promise.all([
        fsUtility.setDirIcon(instance.balloonDir),
        fsUtility.setDirShortcut(instance.balloonDir),
      ]).then(() => {
        done(null, 'ensure folder sidebar/icon');
      }).catch((error) => {
        handleError(error);
      });
    } else {
      done(null, 'no active instance, nothing to do.');
    }
  } catch(err) {
    handleError(err);
  }
}
