const fs           = require('fs')
const logger       = require('../lib/logger.js')
const clientConfig = require('../lib/config.js')
const fsUtility    = require('../lib/fs-utility.js')

module.exports = function (previousVersion, currentVersion, done) {
  logger.info('Running migraton to 0.0.34', {category: 'migration'})

  try {
    var balloonDir = clientConfig.get('balloonDir'),
        homeDir    = clientConfig.get('homeDir')

    if (fs.existsSync(balloonDir)) {
      fsUtility.createContextMenu(balloonDir, homeDir)
    } else {
      logger.info('Migration to 0.0.34: no balloon data folder, nothing to do', {category: 'migration'})
      return done(null, 'No balloon data folder, nothing to do.')
    }

    done(null, 'Set new context menu entry')
  } catch (err) {
    logger.error('failed migrate to 0.0.34', {
      category: 'migration',
      error   : err
    })
    done(err)
  }
}
