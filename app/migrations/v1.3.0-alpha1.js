const fs = require('fs');
const path = require('path');

const async = require('async');
const nedb = require('nedb');

const logger = require('../lib/logger.js');
const paths = require('../lib/paths.js');

module.exports = function(previousVersion, currentVersion, done) {
  const migrationVersion = '1.3.0-alpha1';
  logger.info(`running migraton to ${migrationVersion}`, {category: 'migration'});

  function handleError(err) {
    logger.error(`failed migrate to ${migrationVersion}`, {
      category: 'migration',
      error: err
    });

    done(err);
  }

  const instancesFile = paths.getInstancesFile();

  if(!fs.existsSync(instancesFile)) {
    logger.info(`instances file not present, skipping migration to ${migrationVersion}`, {category: 'migration'});
    return done();
  }

  try {
    const instancesConfig = JSON.parse(fs.readFileSync(instancesFile, 'utf8'));
    const instances = instancesConfig.instances;

    if(!instances) return done();

    async.map(Object.keys(instances), (instanceName, cb) => {
      const instanceDir = paths.getInstanceDir(instanceName);
      if(!fs.existsSync(instanceDir)) return cb(null);

      const pDb = path.join(instanceDir, 'db/nodes.db');
      if(!fs.existsSync(pDb)) return cb(null);

      updateDb(pDb, cb);
    }, (err) => {
      if(err) return handleError(err);

      done();
    });
  } catch(err) {
    handleError(err);
  }
}

function updateDb(pDb, callback) {
  const db = new nedb({
    filename: pDb,
    autoload: true,
    onload: (err) => {
      if(err) return callback(err);

      db.find({}, (err, nodes) => {
        if(err) return callback(err);

        async.mapLimit(nodes, 10, (node, cb) => {
          if(!node.ino) return cb();

          const inoBigInt = BigInt(node.ino);

          db.update({_id: node._id}, {$set: {ino: inoBigInt.toString()}}, cb);
        }, callback);
      });
    }
  });
}
