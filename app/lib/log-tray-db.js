const nedb = require('nedb');

let connected = false;

//TODO pixtron - make period configurable via env
const expiredAfterMilliSeconds = 3 * 24 * 60 * 60 * 1000;

const logTrayDb = {
  isConnected: function() {
    return connected;
  },

  connect: function(collectionPath, force) {
    if(force !== true && this.isConnected()) return;

    this.db = new nedb({
      filename: collectionPath,
      autoload: true
    });

    this.db.ensureIndex({fieldName: 'hash'});

    //remove expired records
    const dateExpired = new Date();
    dateExpired.setTime(dateExpired.getTime() - expiredAfterMilliSeconds);
    this.db.remove({date: {$lt: dateExpired}})

    connected = true;
  },

  getErrors: function(callback) {
    const dateExpired = new Date();
    dateExpired.setTime(dateExpired.getTime() - expiredAfterMilliSeconds);
    this.db.find({date: {$gt: dateExpired}}).sort({date: -1}).exec(callback);
  },

  findOne: function(query, callback) {
    this.db.findOne(query, callback);
  },

  insert: function(entry, callback) {
    this.db.insert(entry, callback);
  },

  update: function(query, entry, callback) {
    this.db.update(query, entry, callback);
  },
}

module.exports = logTrayDb;
