const fs = require('graceful-fs');
const path = require('path');

let resourcesPath;
if(process.defaultApp) {
  resourcesPath = path.resolve(__dirname, '../resources');
} else {
  resourcesPath = path.resolve(process.resourcesPath);
}

let homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
let userEnvPath = path.join(homeDir, '.balloon', 'env.json');
const appEnvPath = path.join(resourcesPath, 'env.json');
let env;

try {
  if(fs.existsSync(appEnvPath)) {
    env = require(appEnvPath)
    fs.writeFileSync(userEnvPath, JSON.stringify(env, null, 2));
  } else {
    env = require(userEnvPath);
  }
} catch(e) {
  env = {name: 'production'};
}

module.exports = env;
