const fs = require('graceful-fs');
const path = require('path');
const {exec, execSync} = require('child_process');
const logger = require('./logger.js');
const prependFile = require('prepend-file');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const { nodeIcon, sidebar } = require('@gyselroth/node-advanced-desktop');

const env = require('../env.js');

function getIcon() {
  var resourcesPath;
  if(process.defaultApp) {
    resourcesPath = path.resolve(__dirname, '../../');
  } else {
    resourcesPath = path.resolve(process.resourcesPath);
  }

  return process.plattform === 'win32' ? path.resolve(resourcesPath, 'resources/diricon/icon.ico') : path.resolve(resourcesPath, 'resources/diricon/icon.png');
}

function getFileiconPath() {
  if(!process.defaultApp) {
    return path.resolve(process.resourcesPath, 'node_modules/fileicon/bin/fileicon');
  }
}

module.exports = {
  createBalloonDir: function(balloonDir, homeDir, callback) {
    this.mkdirp(balloonDir, async (err) => {
      if(err) return callback(err);

      await Promise.all([
        this.setDirIcon(balloonDir),
        this.setDirShortcut(balloonDir),
      ]);

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
    return nodeIcon.setFolderIcon(balloonDir, getIcon(), {
      cmd: getFileiconPath()
    });
  },

  setDirShortcut: function(balloonDir) {
    return sidebar.ensureItem(balloonDir, {
      clsId: '5410396b-e8fa-479c-af05-c0edf82fb954',
      icon: getIcon()
    })
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
