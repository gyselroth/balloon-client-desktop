const fs = require('graceful-fs');
const path = require('path');
const url = require('url');
const {shell} = require('electron');
const logger = require('./logger.js');

const BURL_EXTENSION = 'burl';
const isSameOrSubPath = (parent, child) => {
  if (child === parent) return true
  const parentTokens = parent.split(path.sep).filter(i => i.length)
  logger.error(child);
  logger.error(child.split(path.sep));
  return parentTokens.every((t, i) => child.split(path.sep)[i + 1] === t)
}

class BalloonBurlHandler {
  constructor(clientConfig) {
    this.clientConfig = clientConfig;
  }

  isBalloonBurlPath(burlPath) {
    logger.debug(`checking path [${burlPath}]`, {category: 'burl'});
    try {
      let parsedPath = path.parse(burlPath);
      if (parsedPath.ext !== '.' + BURL_EXTENSION) {
        return false;
      }
      return fs.existsSync(burlPath);
    } catch (error) {
      logger.debug(error, {category: 'burl'});
      return false;
    }
  }

  handleBurl(burlPath) {
    logger.debug(`handling burl file [${burlPath}]`, {category: 'burl'});
    return new Promise((resolve, reject) => {
      try {
        if (isSameOrSubPath(this.clientConfig.get('balloonDir'), path.parse(burlPath).dir)) {
          fs.readFile(burlPath, 'utf8', (error, data) => {
            if (error) {
              logger.debug(error, {category: 'burl'});
              reject(new Error(`can not read burl file [${burlPath}]`));
            } else {
              try {
                let burl = new url.URL(data);
                logger.debug(`handling burl [${burl.href}]`, {category: 'burl'});
                shell.openExternal(burl.href);
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          });
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }

    })
  }
}

module.exports = {
  BURL_EXTENSION,
  BalloonBurlHandler,
};
