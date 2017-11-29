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

    switch(process.platform) {
      case 'win32':
        var balloonContextMenuCommand = path.resolve(resourcesPath, 'resources/context_menu/win32/contextmenu.cmd'),
            balloonIcon               = path.resolve(resourcesPath, 'resources/diricon/icon.ico'),
            balloonAppliesTo          = 'System.ItemFolderPathDisplay:"*\Balloon*"',
            balloonCommandParam       = ' --nodePath \"%D\"',
            balloonContextMenuName, balloonCommand

		if(process.defaultApp) {
		  balloonContextMenuName = 'balloon_dev'
          balloonCommand         = '"'+resourcesPath + '\\node_modules\\.bin\\electron ' + resourcesPath + '/app/main.js' + balloonCommandParam+'"'
		} else {
	      balloonContextMenuName = 'balloon'
          balloonCommand         = '"'+path.resolve(resourcesPath, '../Balloon.exe') + balloonCommandParam+'"';
		}	

		var cmd = [
          balloonContextMenuCommand,
          balloonContextMenuName,
          balloonAppliesTo,
          balloonCommand,
          balloonIcon
        ].join(' ');

        logger.debug('add context menu to win32 registry', {
          category: 'fsutility',
          cmd: cmd
        });
		
        exec(cmd)
        break;
      case 'darwin':
        var balloonContextMenu             = path.resolve(resourcesPath, 'resources/context_menu/darwin/balloon.workflow'),
            balloonContextMenuTmp          = path.resolve(resourcesPath, 'resources/context_menu/darwin/tmp'),
            balloonServicePath             = path.resolve(homeDir, 'Library/Services'),
            balloonAppleScriptCommandParam = ' --nodePath " &amp; "\'" &amp; nodePath &amp; "\'',
            balloonServiceName, balloonAppleScriptCommand

        if(process.defaultApp) {
            balloonServiceName        = 'balloon_dev.workflow'
            balloonAppleScriptCommand = 'cd ' + resourcesPath + '/node_modules/electron &amp;&amp; /usr/local/bin/node cli.js ../../app/main.js' + balloonAppleScriptCommandParam
		} else {
            balloonServiceName        = 'balloon.workflow'
            balloonAppleScriptCommand = '/Applications/Balloon.app/Contents/MacOS/Balloon' + balloonAppleScriptCommandParam
        }

        balloonContextMenuTmp = path.join(balloonContextMenuTmp, balloonServiceName)

        logger.debug('add context menu applescript workflow', {
          category: 'fsutility',
          data: {
            workflow: balloonContextMenu,
            tmp: balloonContextMenuTmp,
            service: balloonServicePath,
            cmd: balloonAppleScriptCommandParam
          }
        });

        exec([
          'cp -r',
          balloonContextMenu,
          balloonContextMenuTmp
        ].join(' '), exec.ExecOptionsWithStringEncoding, (err) => {
          if (err) {
            return logger.error('failed add applescript workflow', {
              category: 'fsutility',
              error: err
            })
          }

          var balloonServiceFile = path.join(balloonContextMenuTmp, 'Contents/document.wflow');
          fs.readFile(balloonServiceFile, 'utf-8', (err, data) => {
            if(err) {
              return logger.error('failed read applescript workflow', {
                category: 'fsutility',
                error: err
              })
            }

            var balloonAppleScript = 'on run {input, parameters}\n' +
                                      'set nodePath to (the POSIX path of input)\n' +
                                      'do shell script "' + balloonAppleScriptCommand + '"\n' +
                                      'return input\n' +
                                     'end run\n'

            fs.writeFile(balloonServiceFile, data.replace('{balloon_apple_script}', balloonAppleScript), 'utf8', (err) => {
              if(err) {
                return logger.error('failed modify applescript workflow', {
                  category: 'fsutility',
                  error: err
                })
              }

              exec([
                'mv',
                balloonContextMenuTmp,
                balloonServicePath
              ].join(' '));
            })
          })
        });
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
