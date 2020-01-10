const path = require('path');
const util = require('util');

const objectHash = require('object-hash');
const TransportStream = require('winston-transport');

const logTrayDb = require('./log-tray-db.js');

module.exports = class TrayTransport extends TransportStream {
  constructor(options = {}) {
    super(options);

    // Expose the name of this Transport on the prototype
    this.name = options.name || 'tray';
    this.level = options.level || 'error';

    if(!options.config || !options.config.instanceDir) {
      this.hasInstanceDir = false;
      return;
    } else {
      this.hasInstanceDir = true;
    }

    logTrayDb.connect(path.join(options.config.instanceDir, 'db', 'log-tray.db'));
  }

  log(info, callback) {
    if(!this.hasInstanceDir) {
      //could not log entry without instanceDir
      return callback(null, false);
    }

    const hash = objectHash({
      level: info.level,
      message: info.message,
      meta: info.metadata,
    });

    logTrayDb.findOne({hash: hash}, (err, entry) => {
      if(err) return callback(err, false);

      if(entry === null) {
        const logEntry = {
          hash,
          message: info.message,
          date: new Date()
        };

        logTrayDb.insert(logEntry, err => {
          if(err) return callback(err, false);

          callback(null, true);
        });
      } else {
        //just update the date to keep it on top
        entry.date = new Date();

        logTrayDb.update({'_id': entry._id}, entry, err => {
          if(err) return callback(err, false);

          callback(null, true);
        });
      }
    });
  }
}
