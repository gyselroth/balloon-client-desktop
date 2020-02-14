const os = require('os');
const fs = require('graceful-fs');
const path = require('path');
const extend = require('util')._extend;
const PassThrough = require('stream').PassThrough;
const si = require('systeminformation');

const {app, ipcMain, BrowserWindow} = require('electron');
const async = require('async');
const archiver = require('archiver');
const request = require('request');
const logger = require('../../lib/logger.js');
const globalConfig = require('../../lib/global-config.js');
const instance = require('../../lib/instance.js');
const url = require('url');

module.exports = function(env, clientConfig) {
  let autoReportInterval;

  ipcMain.on('feedback-send', (event, text, file) => {
    send(text, file).then(function(reportDir, reportPath) {
      logger.info('sending feedback was successfull', {category: 'feedback'});
      event.sender.send('feedback-send-result', true);
    }).catch(function(err) {
      logger.error('got error while sending feedback', {
        category: 'feedback',
        error: err
      });

      event.sender.send('feedback-send-result', false);
    });
  });

  function toggleAutoReport(state) {
    if(state === false) {
      logger.info('disabling auto report', {category: 'feedback'});
      if(autoReportInterval) clearInterval(autoReportInterval);
    } else {
      logger.info('enabling auto report', {category: 'feedback'});
      autoReportInterval = setInterval(sendAutoReport, (env.autoReportInterval || 300000))
    }
  }

  function getFeedbackUrl() {
    var endpoint = '/api/v2/feedbacks'
    var blnUrl = clientConfig.has('blnUrl') ? clientConfig.get('blnUrl') : env.blnUrl;

    if(blnUrl) return `${blnUrl}${endpoint}`;

    logger.debug('blnUrl is not set, trying to get url from lastActiveInstance', {
      category: 'feedback',
      lastActiveInstance: instance.getLastActiveInstance()
    });

    try {
      var last = instance.getInstanceByName(instance.getLastActiveInstance());

      if(last && last.server) {
        return `${last.server}${endpoint}`;
      }
    } catch(err) {
      logger.error('could not get lastActiveinstance', {category: 'feedback', err});
    }

    return
  }

  function sendRequest(text, archive) {
    return new Promise((resolve, reject) => {
      var feedbackUrl = getFeedbackUrl();

      if(!feedbackUrl) {
        logger.error('blnUrl is not set, can\'t send feedback', {
          category: 'feedback',
        });

        return reject();
      }

      logger.info('Sending feedback', {category: 'feedback', feedbackUrl});

      var formData = {feedback: text};

      if(archive) {
        var report = new PassThrough();

        formData.report = {
          value:  report,
          options: {
            filename: [clientConfig.get('username'), Math.floor(new Date().getTime() / 1000)].join('_'),
            contentType: 'application/zip',
            // set length to NaN to avoid request setting content-length header: https://github.com/form-data/form-data/pull/397#issuecomment-471976669
            knownLength: NaN
          }
        }

        archive.pipe(report);
      }

      var reqOptions = {
        url: feedbackUrl,
        formData: formData,
        headers: {
          'X-Client': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname()].join('|'),
          'User-Agent': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname(), os.platform(), os.release()].join('|'),
        }
      }

      var req = request.post(reqOptions);

      req.on('error', function(err) {
        logger.error('sending feedback failed', {category: 'feedback', error: err});
        reject(err);
      });

      req.on('response', function(response) {
        if(response.statusCode === 200) {
          logger.info('got response ', {category: 'feedback', response});
          resolve();
        } else {
          logger.error('got response ', {category: 'feedback', response});
          reject();
        }
      });

      req.on('aborted', function(err) {
        logger.error('request has been aborted by the server', {category: 'feedback', error: err});
        reject(err);
      });
    })
  }

  function sendAutoReport() {
    logger.debug('sending auto report', {category: 'feedback'});

    var text = `Autoreport ${clientConfig.get('username')}`;

    var archive = archiver('zip', {zlib: { level: 9 }});

    archive.on('error', function(err) {
      logger.error('sending auto report failed', {
        category: 'feedback',
        error: err
      });
    });

    appendLogFilesToArchive(archive, false);

    archive.finalize();

    sendRequest(text, archive)
  }


  function send(text, file) {
    logger.info('sending feedback triggered', {
      category: 'feedback'
    });

    return new Promise(function(resolve, reject) {
      if(file === true) {
        var archive = archiver('zip', {zlib: { level: 9 }});

        archive.on('error', function(err) {
          logger.error('sending feedback failed', {
            category: 'feedback',
            error: err
          });

          reject(err);
        });

        async.parallel([
          async.reflect(async (cb) => {
            archive.glob('**/*', {
              cwd: clientConfig.get('configDir'),
              ignore: ['**/temp/**'],
            });

            cb(null);
          }),
          async.reflect(async (cb) => {
            archive.append(await getMetaData(), {name: 'report/metadata.json'});
            cb(null);
          }),
          async.reflect((cb) => {
            createDirectorySnapshot((err, snapshot) => {
              if(err) {
                logger.error('creating directory snapshot failed', {category: 'feedback', err});
                return cb(err);
              }

              archive.append(snapshot, {name: 'report/snapshot.json'});

              cb(null);
            });
          }),
        ], (err, results) => {
          //err will be always `null` as async.reflect is used
          archive.finalize();
        });
      }

      sendRequest(text, archive).then(resolve).catch(reject)
    });
  }

  function appendLogFilesToArchive(archive, includeRotatedLogFiles) {
    if(includeRotatedLogFiles) {
      var rotatedLogfiles = fs.readdirSync(clientConfig.get('configDir')).filter((node) => {
        return node.match(/^(sync|error)\d+\.log$/) !== null;
      });

      rotatedLogfiles.forEach((filename) => {
        var rotatedLogPath = path.join(clientConfig.get('configDir'), filename);
        if(fs.existsSync(rotatedLogPath)) {
          archive.append(fs.createReadStream(rotatedLogPath), { name: 'report/'+filename });
        }
      });
    }

    var snycLogPath = path.join(clientConfig.get('configDir'), 'sync.log');
    if(fs.existsSync(snycLogPath)) {
      archive.append(fs.createReadStream(snycLogPath), { name: 'report/sync.log' });
    }

    var errorLogPath = path.join(clientConfig.get('configDir'), 'error.log');
    if(fs.existsSync(errorLogPath)) {
      archive.append(fs.createReadStream(errorLogPath), { name: 'report/error.log' });
    }
  }

  async function getMetaData() {
    var now = new Date();
    var offset = now.getTimezoneOffset();
    var absOffset = Math.abs(offset);

    function pad(value) {
      return value < 10 ? '0' + value : value;
    }

    var envForReport = Object.assign({}, env);
    if(envForReport.auth && envForReport.auth.oidc && Array.isArray(envForReport.auth.oidc)) {
      envForReport.auth.oidc = envForReport.auth.oidc.map(idpConfig => {
        if(idpConfig.clientSecret) {
          idpConfig.hasClientSecret = true;
          delete idpConfig.clientSecret;
        } else {
          idpConfig.hasClientSecret = false;
        }

        return idpConfig;
      });
    }

    var system = {};

    try {
      system = await si.getAllData();
      delete system.networkConnections;
    } catch(err) {
      logger.error('got error while sending feedback', {
        category: 'feedback',
        error: err
      });

      system = 'si.getAllData() call had an error (ask user for error.log)';
    }

    var metaData = {
      version: app.getVersion(),
      hasToken: clientConfig.get('accessToken') !== undefined,
      date: {
        utc: now,
        offset: (offset > 0 ? '-' : '+') + pad(Math.floor(absOffset / 60)) + ':' + pad(absOffset % 60)
      },
      locale: app.getLocale(),
      env: envForReport,
      system: system,
      localEnv: process.env
    }

    return JSON.stringify(metaData, null, 2);
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
    toggleAutoReport
  }
}
