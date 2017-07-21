const fs = require('graceful-fs');
const path = require('path');
const {exec} = require('child_process');
const logger = require('./logger.js');

const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

module.exports = {
  createBalloonDir: function(balloonDir, callback) {
    this.mkdirp(balloonDir, (err) => {
      if(err) return callback(err);

      this.setDirIcon(balloonDir);

      callback(null);
    });
  },

  setDirIcon: function(balloonDir) {
    var resourcesPath;
    if(process.defaultApp) {
      resourcesPath = path.resolve(__dirname, '../../');
    } else {
      resourcesPath = path.resolve(process.resourcesPath);
    }

    switch(process.platform) {
      case 'darwin':
        exec([
          path.resolve(resourcesPath, 'resources/diricon/osx'),
          'set',
          balloonDir,
          path.resolve(resourcesPath, 'resources/diricon/icon.png')
        ].join(' '));
      break;
      case 'win32':
        exec([
          path.resolve(resourcesPath, 'resources/diricon/win.cmd'),
          balloonDir,
          path.resolve(resourcesPath, 'resources/diricon/icon.ico')
        ].join(' '));
      break;
    }
  },

  mkdirp: function(dir, callback) {
    mkdirp(dir, {fs}, callback);
  },

  mkdirpSync: function(dir) {
    mkdirp.sync(dir, {fs});
  },

  rmdirp: function(dir, callback) {
    var options = {
      maxBusyTries: 10,
      disableGlob: true,
      unlink: fs.unlink,
      chmod: fs.chmod,
      stat: fs.stat,
      lstat: fs.lstat,
      rmdir: fs.rmdir,
      readdir: fs.readdir
    };

    rimraf(dir, options, callback);
  }

}
