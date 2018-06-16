const {EOL} = require('os');
const { exec } = require('child_process');


const async = require('async');

const logger = require('./logger.js');

module.exports = function(balloonDir, callback) {
  var cmds;
  switch (process.platform) {
    case 'darwin':
      cmds = ['df -Hi', 'mount'];
    break;
    case 'win32':
      var drive = balloonDir.slice(0, 2);
      cmds = ['fsutil fsinfo volumeinfo ' + drive, 'fsutil volume diskfree ' + drive];
    break;
    default:
      cmds = ['df -hiT', 'df -hT'];
  }

  async.map(cmds, (cmd, cb) => {
    exec(cmd, (err, result) => {
      if(err) {
        logger.error('shell exec error', {cmd, err, category: 'fs-info'});
        return cb(err);
      }

      cb(null, {cmd, result});
    });
  }, (err, results) => {
    if(err) return callback(err);

    var out = '';

    for(i=0; i<results.length; i++) {
      var result = results[i];

      out += result.cmd + EOL;
      out += result.result;

      if(i < results.length -1) out += EOL + EOL;
    }

    callback(null, out);
  });
}
