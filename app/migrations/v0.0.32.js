const fs = require('fs');
const path = require('path');

const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');
const clientConfig = require('../lib/config.js');
const fsUtility = require('../lib/fs-utility.js');

module.exports = function(previousVersion, currentVersion, done) {
  logger.info('Running migraton to 0.0.32', {category: 'migration'});

  try {
    var homeDir = clientConfig.get('homeDir');
    var balloonDir = clientConfig.get('balloonDir');

    if(fs.existsSync(balloonDir)) {
      fsUtility.setDirIcon(balloonDir);
      fsUtility.setDirShortcut(balloonDir, homeDir);
    } else  {
      logger.info('Migration to 0.0.32: no balloon data folder, nothing to do');
      return done(null, 'No balloon data folder, nothing to do.');
    }

    done(null, 'Set new folder folder icon and added bookmark');
  } catch(err) {
    logger.error('failed migrate to 0.0.32', {
      category: 'migration',
      error: err
    });
    done(err);
  }
}
