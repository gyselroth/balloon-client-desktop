const fs = require('fs');
const path = require('path');

const electron = require('electron');

if(process.type === 'browser') {
  var ElectronSettings = require('electron-settings/lib/settings.js');
} else {
  var ElectronSettings = electron.remote.require('electron-settings/lib/settings.js');
}

const env = require('../env.js');
const fsUtility = require('./fs-utility.js');
const paths = require('./paths.js');

let settings;

function configFactory() {
  if(settings !== undefined) return settings;

  const configDir = paths.getConfigDir();
  const configFile = path.join(configDir, 'config-'+env.name+'.json');

  if(!fs.existsSync(configDir)) {
    fsUtility.mkdirpSync(configDir);
  }

  settings = new ElectronSettings();

  settings.setPath(configFile);

  setDefaultConfig();

  return settings;
}

function setDefaultConfig() {
  // enableAutoLaunch defaults to true
  if(!settings.has('enableAutoLaunch')) settings.set('enableAutoLaunch', (env.enableAutoLaunch !== false));

  // allowPrerelease defaults to false
  if(!settings.has('allowPrerelease')) settings.set('allowPrerelease', !(env.enableAutoLaunch !== true));

  // autoReport defaults to false
  if(!settings.has('autoReport')) settings.set('autoReport', !(env.autoReport !== true));
}

module.exports = configFactory();
