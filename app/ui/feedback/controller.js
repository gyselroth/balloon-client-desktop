const os = require('os');
const fs = require('graceful-fs');
const path = require('path');
const extend = require('util')._extend;

const {app, ipcMain, BrowserWindow} = require('electron');
const async = require('async');
const archiver = require('archiver');
const request = require('request');


const logger = require('../../lib/logger.js');
const fsInfo = require('../../lib/fs-info.js');

const url = require('url');
const windowStatesFactory = require('../window-states.js');

var feedbackWindow;

module.exports = function(env, clientConfig, sync) {
  windowStates = windowStatesFactory(env);

  function close() {
    logger.info('feedback: close requested');
    if(feedbackWindow) feedbackWindow.close();
  }

  function open() {
    logger.info('feedback: open requested');
    if(!feedbackWindow) feedbackWindow = createWindow();

    feedbackWindow.show();
    feedbackWindow.focus();
  }

  function createWindow() {
    if(feedbackWindow) return feedbackWindow;

    feedbackWindow = new BrowserWindow({
      width: 600,
      height: 450,
      show: false,
      frame: true,
      fullscreenable: false,
      resizable: false,
      transparent: false,
      skipTaskbar: false,
      icon: __dirname+'/../../img/taskbar_black.png'
    });

    feedbackWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    feedbackWindow.setMenu(null);

    feedbackWindow.on('closed', (event) => {
      feedbackWindow = null;

      windowStates.closed('feedback');

      logger.info('Feedback: closed');
    });

    feedbackWindow.on('show', (event) => {
      windowStates.opened('feedback');

      logger.info('feedback: opened');
    });

    feedbackWindow.on('focus', (event) => {
      feedbackWindow.webContents.send('update-window');
    });

    if(env.name === 'development') {
      //feedbackWindow.openDevTools();
    }

    ipcMain.on('feedback-send', (event, text, file) => {
      send(text, file).then(function(reportDir, reportPath) {
        logger.error('feedback: sending feedback successfull');
        event.sender.send('feedback-send-result', true);
      }).catch(function(err) {
        logger.error('feedback: got error while sending feedback', {err});
        event.sender.send('feedback-send-result', false);
      });
    });

    return feedbackWindow;
  }

  function send(text, file) {
    logger.info('feedback: sending error report triggered');

    return new Promise(function(resolve, reject) {
      var reportName = [clientConfig.get('username'), Math.floor(new Date().getTime() / 1000)].join('_');
      var archive = archiver('zip', {zlib: { level: 9 }});

      archive.on('error', function(err) {
        logger.error('feedback: sending error report failed', err);
        reject(err);
      });

      var req = request.put('https://support.gyselroth.net/balloon/' + reportName+'?feedback='+encodeURIComponent(text));

      req.on('error', function(err) {
        logger.error('feedback: sending error report failed', err);
        reject(err);
      });

      req.on('response', function(response) {
        if(response.statusCode === 200) {
          logger.info('feedback: got response ', {response});
          resolve(reportName);
        } else {
          logger.error('feedback: got response ', {response});
          reject();
        }
      });

      req.on('aborted', function(err) {
        logger.error('feedback: request has been aborted by the server', err);
        reject(err);
      });

      if(file === true) {
      archive.pipe(req);

      var snycLogPath = path.join(clientConfig.get('configDir'), 'sync.log');
      if(fs.existsSync(snycLogPath)) {
        archive.append(fs.createReadStream(snycLogPath), { name: 'report/sync.log' });
      }

      var errorLogPath = path.join(clientConfig.get('configDir'), 'error.log');
      if(fs.existsSync(errorLogPath)) {
        archive.append(fs.createReadStream(errorLogPath), { name: 'report/error.log' });
      }

      var dbPath = path.join(clientConfig.get('configDir'), 'db', 'nodes.db');
      if(fs.existsSync(dbPath)) {
        archive.append(fs.createReadStream(dbPath), { name: 'report/nodes.db' });
      }

      var errorDbPath = path.join(clientConfig.get('configDir'), 'db', 'api-error-queue.db');
      if(fs.existsSync(errorDbPath)) {
        archive.append(fs.createReadStream(errorDbPath), { name: 'report/api-error-queue.db' });
      }

      var transferDbPath = path.join(clientConfig.get('configDir'), 'db', 'transfer.db');
      if(fs.existsSync(transferDbPath)) {
        archive.append(fs.createReadStream(transferDbPath), { name: 'report/transfer.db' });
      }

      var remoteDeltaLogDbPath = path.join(clientConfig.get('configDir'), 'db', 'remotedelta-log.db');
      if(fs.existsSync(remoteDeltaLogDbPath)) {
        archive.append(fs.createReadStream(remoteDeltaLogDbPath), { name: 'report/remotedelta-log.db' });
      }

      archive.append(getMetaData(), {name: 'report/metadata.json'});

      async.parallel([
        (cb) => {
          createDirectorySnapshot((err, snapshot) => {
            if(err) return cb(err);

            archive.append(snapshot, {name: 'report/snapshot.json'});

            cb(null);
          })
        },
        (cb) => {
          fsInfo(clientConfig.get('balloonDir'), (err, result) => {
            if(err) return cb(err);

            archive.append(result, { name: 'report/fs.txt' });

            return cb(null);
          });

        }
      ], (err, results) => {
        if(err) return reject(err);

        archive.finalize();
      });
      }
    });
  }

  function getMetaData() {
    var now = new Date();
    var offset = now.getTimezoneOffset();
    var absOffset = Math.abs(offset);

    var config = extend({}, clientConfig.getAll());

    function pad(value) {
      return value < 10 ? '0' + value : value;
    }

    var metaData = {
      hasToken: clientConfig.get('accessToken') !== undefined,
      lastCursor: getLastCursor(),
      date: {
        utc: now,
        offset: (offset > 0 ? '-' : '+') + pad(Math.floor(absOffset / 60)) + ':' + pad(absOffset % 60)
      },
      locale: app.getLocale(),
      config,
      env: env,
      os: {
        arch: os.arch(),
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
        endianness: os.endianness(),
        homedir: os.homedir(),
        hostname: os.hostname(),
        tmpdir: os.tmpdir(),
        uptime: os.uptime(),
        cpus: os.cpus(),
        networkInterfaces: os.networkInterfaces(),
        userInfo: os.userInfo()
      }
    }

    delete metaData.config.accessToken;

    return JSON.stringify(metaData, null, 2);
  }

  function getLastCursor() {
    var pathCursorStorage = path.join(clientConfig.get('configDir'), 'last-cursor');

    if(fs.existsSync(pathCursorStorage)) {
      var cursorFromStorage = fs.readFileSync(pathCursorStorage).toString();

      return cursorFromStorage !== '' ? cursorFromStorage : undefined;
    }

    return undefined;
  }

  function createDirectorySnapshot(callback) {
    var snapshot = {};
    var prefix = clientConfig.get('balloonDir');

    readdir(clientConfig.get('balloonDir'), (err) => {
      if(err) return callback(err);

      callback(null, formatDirectorySnapshot(snapshot));
    });

    function formatDirectorySnapshot(snapshot) {
      return JSON.stringify(snapshot)
          .replace(/^\{/, '\{\n  ')
          .replace(/\:\[/g, '\: \[\n    ')
          .replace(/\}\],/g, '\}\n  \],\n  ')
          .replace(/\},\{/g, '\},\n    \{')
          .replace(/\]\}$/, '\n  ]\n}')
    }

    function readdir(dir, callback) {
      var dirNodes = [];
      var dirRel = dir.replace(prefix, '');
      if(dirRel.slice(-1) !== '/') dirRel = dirRel + '/';

      fs.readdir(dir, (err, nodes) => {
        if(err) return callback(err);

        async.map(nodes, (node, cb) => {
          var curPath = path.join(dir, node);
          var stat = fs.lstatSync(curPath);

          var nodeRepresentation = {
            name: node,
            stat: {
              ino: stat.ino,
              size: stat.size,
              ctime: stat.ctime,
              mtime: stat.mtime
            },
            parent: dirRel,
            directory: stat.isDirectory()
          }

          dirNodes.push(nodeRepresentation);

          if(stat.isDirectory()) {
            readdir(curPath, cb);
          } else {
            cb(null);
          }
        }, (err) => {
          if(dirNodes.length > 0) snapshot[dirRel] = dirNodes;
          callback(null);
        });
      });
    }
  }

  return {
    close,
    open
  }
}
