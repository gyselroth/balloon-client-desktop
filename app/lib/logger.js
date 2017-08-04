const path = require('path');

const winston = require('winston');

let _logger;

module.exports = function() {
  var errorLevels = {error: 3, err: 3, warning: 4, warn: 4, notice: 5, info: 6, debug: 7};
  var defaultLogger = new (winston.Logger)({
    levels: errorLevels
  });

  defaultLogger.add(winston.transports.Console, {
    level: 'debug',
    prettyPrint: true,
    depth: 6,
    humanReadableUnhandledException: true
  });

  var logger = {
    setLogger: function(logger) {
      _logger = logger;
    },
    getLogger: function() {
      return _logger;
    }
  }

  Object.keys(errorLevels).forEach((level) => {
    logger[level] = function() {
      if(level === 'err') {
        level = 'error';
      } else if(level === 'warn') {
        level = 'warning';
      }

      _logger[level].apply(this, arguments);
    }
  });


  logger.setLogger(defaultLogger);

  return logger;
}()
