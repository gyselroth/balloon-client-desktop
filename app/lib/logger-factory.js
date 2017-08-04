var path = require('path');

const winston = require('winston');

const env = require('../env.js');

const logLevels = {error: 3, err: 3, warning: 4, warn: 4, notice: 5, info: 6, debug: 7};
let logger;

module.exports = function(config, logfile) {
  if(!logger) {
    const pathLogFile = path.join(config.configDir, logfile || 'error.log');
    const logConfig = env.log || {};
    logger = new (winston.Logger)({levels: logLevels});

    if(env.context !== 'test') {
      logger.add(winston.transports.File, {
        filename: pathLogFile,
        level: logConfig.logLevel || 'info',
        maxsize: logConfig.maxsize || 10000000,
        maxFiles: logConfig.maxFiles || 10,
        json: true,
        showLevel: true,
        tailable: true,
        zippedArchive: true
      });
    }

    if(config.context === 'development') {
      logger.add(winston.transports.Console, {
        level: 'debug',
        prettyPrint: true,
        depth: 6,
        humanReadableUnhandledException: true
      });
    }

  }

  return logger;
}
