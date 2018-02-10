const fs = require('fs');
const path = require('path');

const electron = require('electron');

if(process.type === 'browser') {
  var ElectronSettings = require('electron-settings/lib/settings.js');
} else {
  var ElectronSettings = electron.remote.require('electron-settings/lib/settings.js');
}

const fsUtility = require('./fs-utility.js');
const paths = require('./paths.js');


function stateFactory() {
  const configDir = paths.getConfigDir();
  const stateFile = path.join(configDir, 'state.json');

  if(!fs.existsSync(configDir)) {
    fsUtility.mkdirpSync(configDir);
  }

  const settings = new ElectronSettings();

  settings.setPath(stateFile);

  return settings;
}

module.exports = stateFactory();
