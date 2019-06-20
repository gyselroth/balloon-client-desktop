const fs = require('graceful-fs');
const path = require('path');
const isDev = require('electron-is-dev');

var app;
if(process.type === 'browser') {
  app = require('electron').app;
} else {
  const remote = require('electron').remote;
  app = remote.app;
}

var resourcesPath;
if(isDev) {
  resourcesPath = path.resolve(__dirname, '..');
} else {
  resourcesPath = path.resolve(process.resourcesPath);
}

var envPath = path.join(resourcesPath, 'resources', 'env.json');
var plattformEnvPath;
var env;

var userEnvPath = path.join(app.getPath('userData'), 'env.json');

switch(process.platform) {
  case 'darwin':
  case 'linux':
    plattformEnvPath = '/etc/balloon-desktop/env.json';
  break;
  default:
    plattformEnvPath = envPath;
}

try {
  if(fs.existsSync(envPath)) {
    env = require(envPath);
  } else if(fs.existsSync(userEnvPath)) {
    env = require(userEnvPath);
  } else {
    env = require(plattformEnvPath);
  }
} catch(e) {
  env = {name: 'production'};
}

module.exports = env;
