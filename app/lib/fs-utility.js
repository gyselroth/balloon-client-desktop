const fs = require('graceful-fs');
const path = require('path');
const {exec, execSync} = require('child_process');
const logger = require('./logger.js');
const prependFile = require('prepend-file');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');

const env = require('../env.js');

module.exports = {
  createBalloonDir: function(balloonDir, homeDir, callback) {
    this.mkdirp(balloonDir, (err) => {
      if(err) return callback(err);

      this.setDirIcon(balloonDir);
      this.setDirShortcut(balloonDir, homeDir);
	  this.createContextMenu(balloonDir, homeDir);

      callback(null);
    });
  },

  createConfigDir: function(configDir) {
    if(!fs.existsSync(configDir)) {
      this.mkdirpSync(configDir);

      if(process.platform === 'win32') {
        //"Hide" configDir on win32
        execSync('ATTRIB +H ' + configDir);
      }
    }
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
    var resourcesPath;
    if(process.defaultApp) {
      resourcesPath = path.resolve(__dirname, '../../');
    } else {
      resourcesPath = path.resolve(process.resourcesPath);
    }

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
      case 'win32':
        if(!env.winClsId) return;

        exec([
          path.resolve(resourcesPath, 'resources/shortcut/win.cmd'),
          balloonDir,
          path.resolve(resourcesPath, 'resources/diricon/icon.ico'),
          env.winClsId
        ].join(' '));
      break;
    }
  },

  createContextMenu: function (balloonDir, homeDir) {
    var resourcesPath = process.defaultApp ? path.resolve(__dirname, '../../') : path.resolve(process.resourcesPath);

    if(process.platform === 'win32') {
      var balloonContextMenuCommand = path.resolve(resourcesPath, 'resources/context_menu/win32/contextmenu.cmd');
      var balloonIcon = path.resolve(resourcesPath, 'resources/diricon/icon.ico');
      var balloonAppliesTo = 'System.ItemFolderPathDisplay:"*\Balloon*"';
			
	  var cmd = [
        balloonContextMenuCommand,
        balloonAppliesTo,
        balloonIcon
      ].join(' ');

      logger.debug('add context menu to win32 registry', {
        category: 'fsutility',
        cmd: cmd
      });
		
      exec(cmd)
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
