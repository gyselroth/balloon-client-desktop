const path = require('path');
const fs = require('fs');

const {dialog} = require('electron');

const i18n = require('../../lib/i18n.js');
const logger = require('../../lib/logger.js');

module.exports = function(env, clientConfig) {
  function showError(message) {
    dialog.showMessageBox({
      type: 'error',
      buttons: [],
      title: i18n.__('balloonDirSelector.error.title'),
      message
    });
  }

  function open() {
    logger.info('ballonDir selector open', {category: 'balloon-dir-selector'});

    return new Promise((resolve, reject) => {
      dialog.showOpenDialog({
        title: i18n.__('balloonDirSelector.title'),
        defaultPath: clientConfig.balloonDir,
        properties: ['openDirectory']
      }, (folder) => {
        if(folder) {
          var newPath = path.join(folder[0], 'Balloon');
          var oldPath = clientConfig.get('balloonDir');

          logger.info('ballonDir changed path', {category: 'balloon-dir-selector', oldPath, newPath});

          if(newPath === oldPath) {
            return reject();
          }

          if(newPath.indexOf(oldPath) === 0) {
            //can not move folder in itself
            showError(i18n.__('balloonDirSelector.error.moveIntoItself'));
            return reject();
          }

          if(fs.existsSync(newPath)) {
            //can't move to an existing folder
            showError(i18n.__('balloonDirSelector.error.targetExists'));
            return reject()
          }

          if(fs.existsSync(oldPath)) {
            try {
              fs.renameSync(oldPath, newPath);

              logger.info('moved existing balloonDir to new path', {category: 'balloon-dir-selector', oldPath, newPath});

              clientConfig.set('balloonDir', newPath);
              resolve({newPath, oldPath});
            } catch(err) {
              logger.error('could not move existing balloonDir', {category: 'balloon-dir-selector', err});
              showError(i18n.__('balloonDirSelector.error.unknown'));
              reject();
            }
          } else {
            clientConfig.set('balloonDir', newPath);
            resolve({newPath, oldPath});
          }
        }

        logger.info('no folder selected', {category: 'balloon-dir-selector'});
        reject();
      });
    });
  }

  return {
    open
  }
}
