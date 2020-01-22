var path = require('path');

const electron = require('electron');
const {createLogger, format, transports} = require('winston');
const mergeWith = require('lodash/mergeWith');

const env = require('../env.js');
const TrayTransport = require('./log-tray-transport.js');

const logLevels = {error: 3, err: 3, warning: 4, warn: 4, notice: 5, info: 6, debug: 7};
let logger;

const enrichLogInfo = format(function(info, options) {
  info.level = info.level.toUpperCase();

  info.thread = electron.remote ? electron.remote.getCurrentWindow().id : 'main';
  if(!info.category) info.category = 'category';
  const metadata = info.metadata;
  delete metadata.category;

  info.meta = '';
  if(metadata && Object.keys(metadata).length > 0) {
    const str = JSON.stringify(metadata, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    info.meta = `(${str})`;
  }

  return info;
});

const cloneErrors = format(function(info, options) {
  function errorCloner(objValue, srcValue) {

    if(srcValue instanceof Error) {
      var clone = {};
      // Make sure we clone both enumerable and non-enumerable properties on errors
      Object.getOwnPropertyNames(srcValue).forEach(function(prop) {
          var value = srcValue[prop];

          clone[prop] = value && typeof value === 'object' ?
             // Recurse for objects, to handle inner exceptions
              mergeWith({}, value, errorCloner) :
              value;
      });

      return clone;
    }
  }

  info.metadata = mergeWith({}, info.metadata, errorCloner);

  return info;
});

module.exports = function(config, logfile) {
  if(!logger) {
    const pathLogFile = path.join(config.configDir, logfile || 'error.log');
    const logConfig = env.log || {};

    logger = createLogger({
      levels: logLevels,
      transports: [],
    });

    if(env.context !== 'test') {
      logger.add(new transports.File({
        filename: pathLogFile,
        level: logConfig.logLevel || 'debug',
        maxsize: logConfig.maxsize || 10000000,
        maxFiles: logConfig.maxFiles || 10,
        tailable: true,
        zippedArchive: false,
        format: format.combine(
          format.metadata(),
          cloneErrors(),
          format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
          enrichLogInfo(),
          format.printf(info => `${info.timestamp} ${info.level} <${info.thread}> [${info.category}]: ${info.message} ${info.meta}`)
        ),
      }));

      if(logfile === 'sync.log') {
        logger.add(new TrayTransport({
          level: 'error',
          config,
          format: format.combine(
            format.metadata(),
            cloneErrors(),
          )
        }));
      }
    }

    if(config.context === 'development') {
      logger.add(new transports.Console({
        level: 'debug',
        format: format.combine(
          format.metadata(),
          cloneErrors(),
          enrichLogInfo(),
          format.colorize(),
          format.printf(info => `${info.level} <${info.thread}> [${info.category}]: ${info.message} ${info.meta}`)
        ),
        humanReadableUnhandledException: true,
      }));
    }
  }

  return logger;
}
