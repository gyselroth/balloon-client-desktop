const fs = require('graceful-fs');
const path = require('path');
const mkdirp = require('mkdirp');

let resourcesPath;
if(process.defaultApp) {
  resourcesPath = path.resolve(__dirname, '..');
} else {
  resourcesPath = path.resolve(process.resourcesPath);
}

let homeDir = process.env[(/^win/.test(process.platform)) ? 'USERPROFILE' : 'HOME'];
let configDir = path.join(homeDir, '.balloon');
let userEnvPath = path.join(configDir, 'env.json');
let appEnvPath = path.join(resourcesPath, 'resources', 'env.json');
let env;
let userEnv;

try {
  if(!fs.existsSync(configDir)) {
    mkdirp.sync(configDir, {fs});

    if(process.platform === 'win32') {
      //"Hide" configDir on win32
      execSync('ATTRIB +H ' + configDir);
    }
  }
} catch(e) {
  //ignore
}

try {
  if(fs.existsSync(appEnvPath)) {
    env = require(appEnvPath)

    //only update userspace env if app env version is bigger
    try {
      if(fs.existsSync(userEnvPath)) {
        userEnv = require(userEnvPath)

        if(!userEnv.version || env.version > userEnv.version) {
          fs.writeFileSync(userEnvPath, JSON.stringify(env, null, 2));
        }
      } else {
        fs.writeFileSync(userEnvPath, JSON.stringify(env, null, 2));
      }
    } catch(e) {
      return env;
    }
  } else {
    env = require(userEnvPath);
  }
} catch(e) {
  env = {name: 'production'};
}

module.exports = env;
