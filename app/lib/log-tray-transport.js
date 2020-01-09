const path = require('path');
const util = require('util');

const objectHash = require('object-hash');
const { Transport } = require('winston');

const logTrayDb = require('./log-tray-db.js');

const TrayTransport = function(options) {
  this.name = 'tray';
  this.level = options.level || 'error';

  if(!options.config || !options.config.instanceDir) {
    this.hasInstanceDir = false;
    return;
  } else {
    this.hasInstanceDir = true;
  }

  logTrayDb.connect(path.join(options.config.instanceDir, 'db', 'log-tray.db'));
}

util.inherits(TrayTransport, Transport);

TrayTransport.prototype.log = function (level, message, meta, callback) {
  if(!this.hasInstanceDir) {
    //could not log entry without instanceDir
    return callback(null, false);
  }

  const hash = objectHash({level, message, meta});

  logTrayDb.findOne({hash: hash}, (err, entry) => {
    if(err) return callback(err, false);

    if(entry === null) {
      const logEntry = {
        hash,
        message,
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

module.exports = TrayTransport;
