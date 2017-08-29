const fs = require('graceful-fs');
const path = require('path');
const {exec} = require('child_process');
const logger = require('./logger.js');
const prependFile = require('prepend-file');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

module.exports = {
  createBalloonDir: function(balloonDir, homeDir, callback) {
    this.mkdirp(balloonDir, (err) => {
      if(err) return callback(err);

      this.setDirIcon(balloonDir);
      this.setDirShortcut(balloonDir, homeDir);

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
      case 'linux':
        exec([
          'gvfs-set-attribute',
          balloonDir,
          'metadata::custom-icon',
          'file://'+path.resolve(resourcesPath, 'resources/diricon/icon.png')
        ].join(' '));
      break;
    }
  },

  setDirShortcut: function(balloonDir, homeDir) {
    switch(process.platform) {
      case 'linux':
        var gtk = path.join(homeDir, '.config', 'gtk-3.0');
        if(fs.existsSync(gtk)) {
          var bookmarks = path.join(gtk, 'bookmarks');
          if(fs.existsSync(bookmarks)) {
            fs.readFile(bookmarks, function (err, data) {
              if (err) throw err;
              if(data.indexOf('file://'+balloonDir+"\n") === -1){
                prependFile(bookmarks, 'file://'+balloonDir+"\n", function (err) {
                  if (err) throw err;
                });          
              }
            })
          } else {
            fs.writeFile(bookmarks, 'file://'+balloonDir+"\n", function (err) {
              if (err) throw err;
            });          
          }
        }
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
