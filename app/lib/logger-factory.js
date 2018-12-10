var path = require('path');

const electron = require('electron');
const winston = require('winston');
const mergeWith = require('lodash/mergeWith');
const moment = require('moment');

const env = require('../env.js');

const logLevels = {error: 3, err: 3, warning: 4, warn: 4, notice: 5, info: 6, debug: 7};
let logger;

module.exports = function(config, logfile) {
  if(!logger) {
    const pathLogFile = path.join(config.configDir, logfile || 'error.log');
    const logConfig = env.log || {};
    logger = new (winston.Logger)({levels: logLevels});
    var winstonConfig = winston.config;

    var getThreadName = function() {
      if(electron.remote) {
        return '<'+electron.remote.getCurrentWindow().id+'>';
      } else {
        return '<main>';
      }
    };

    logger.rewriters.push(function(level, msg, meta) {
      return mergeWith({}, meta, function errorCloner(objValue, srcValue) {
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
      });
    });

    if(env.context !== 'test') {
      logger.add(winston.transports.File, {
        filename: pathLogFile,
        level: logConfig.logLevel || 'debug',
        maxsize: logConfig.maxsize || 10000000,
        maxFiles: logConfig.maxFiles || 10,
        json: false,
        tailable: true,
        zippedArchive: true,
        formatter: function(options) {
          var category = 'unknown';
          if(options.meta && options.meta.category) {
            category = options.meta.category;
            delete options.meta.category;
          }

          return moment().format('YYYY-MM-DD HH:mm:ss') + ' ' + options.level.toUpperCase() + ' ' +
            getThreadName() + ' ' +
            '[' +category+ ']: ' +
            (options.message ? options.message : '') +
            (options.meta && Object.keys(options.meta).length ? ' ('+ JSON.stringify(options.meta)+ ')' : '' );
        }
      });
    }

    if(config.context === 'development') {
      logger.add(winston.transports.Console, {
        level: 'debug',
        prettyPrint: true,
        depth: 6,
        humanReadableUnhandledException: true,
        colorize: true,
        formatter: function(options) {
          var category = 'unknown';
          if(options.meta && options.meta.category) {
            category = options.meta.category;
            delete options.meta.category;
          }

          return winstonConfig.colorize(options.level, options.level.toUpperCase()) + ' ' +
            getThreadName() + ' ' +
            '[' +category+ ']: ' +
            (options.message ? options.message : '') +
            (options.meta && Object.keys(options.meta).length ? ' ('+ JSON.stringify(options.meta)+ ')' : '' );
        }
      });
    }
  }

  return logger;
}
