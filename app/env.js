const fs = require('graceful-fs');
const path = require('path');

var resourcesPath;
if(process.defaultApp || process.type !== 'browser') {
  resourcesPath = path.resolve(__dirname, '..');
} else {
  resourcesPath = path.resolve(process.resourcesPath);
}

var envPath = path.join(resourcesPath, 'resources', 'env.json');
var plattformEnvPath;
var env;

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
  } else {
    env = require(plattformEnvPath);
  }
} catch(e) {
  env = {name: 'production'};
}

module.exports = env;
