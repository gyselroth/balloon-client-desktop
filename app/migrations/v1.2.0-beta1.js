const fs = require('fs');
const env = require('../env.js');
const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');
const fsUtility = require('../lib/fs-utility.js');

const { app } = require('electron');
const sudo = require('sudo-prompt');

module.exports = function(previousVersion, currentVersion, done) {
  const migrationVersion = '1.2.0-beta1';
  logger.info(`running migraton to ${migrationVersion}`, {category: 'migration'});

  function handleError(err) {
    logger.error(`failed migrate to ${migrationVersion}`, {
      category: 'migration',
      error: err
    });

    done(err);
  }

  if(process.platform !== 'darwin') {
    logger.info(`platform is not darwin, skipping migration to ${migrationVersion}`, {category: 'migration'});
    return done();
  }

  try {
    const appPath = app.getPath('exe').split('.app/Content')[0] + '.app';
    const icnsPath = fs.existsSync(`${appPath}/Contents/Resources/Balloon.icns`) ? `${appPath}/Contents/Resources/Balloon.icns` : undefined;
    const command = `chown -R ${process.env.USER} ${appPath} && chgrp -R staff ${appPath}`;

    const options = {
      name: 'Balloon',
      icns: icnsPath,
    };

    sudo.exec(command, options, function(error, stdout, stderr) {
      if (error) return handleError(error);

      logger.info(`changed owner and group of ${appPath}`, {category: 'migration'});
      done();
    });
  } catch(err) {
    handleError(err);
  }
}
