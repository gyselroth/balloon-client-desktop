const fs = require('graceful-fs');
const path = require('path');
const url = require('url');
const {shell} = require('electron');
const logger = require('./logger.js');

const BURL_EXTENSION = 'burl';
const isSameOrSubPath = (parent, child) => {
  if (child === parent) return true
  const parentTokens = parent.split(path.sep).filter(i => i.length)
  return parentTokens.every((t, i) => child.split(path.sep)[i + 1] === t)
}

class BalloonBurlHandler {
  constructor(clientConfig) {
    this.clientConfig = clientConfig;
  }

  isBalloonBurlPath(burlPath) {
    logger.debug(`checking path [${burlPath}]`, {category: 'burl-handler'});
    try {
      let parsedPath = path.parse(burlPath);
      if (parsedPath.ext !== '.' + BURL_EXTENSION) {
        return false;
      }
      if (!fs.existsSync(burlPath)) {
        return false;
      }
      return isSameOrSubPath(this.clientConfig.get('balloonDir'), parsedPath.dir);
    } catch (error) {
      logger.debug(error.message, {category: 'burl'});
      return false;
    }
  }

  extractBurl(burlPath) {
    return new Promise((resolve, reject) => {
      fs.readFile(burlPath, 'utf8', (error, data) => {
        if (error) {
          logger.debug(error, {category: 'burl'});
          reject(new Error(`can not read burl file [${burlPath}]`));
        } else {
          try {
            let burl = new url.URL(data);
            resolve(burl.href);
          } catch (error) {
            logger.info(error.message, {category: 'burl-handler'});
            reject({
              error: 'invalid-url',
              burl: data,
            });
          }
        }
      });
    });
  }

  handleBurl(burl) {
    logger.debug(`handling burl [${burl}]`, {category: 'burl-handler'});
    shell.openExternal(burl);
  }
}

module.exports = {
  BURL_EXTENSION,
  BalloonBurlHandler,
};
