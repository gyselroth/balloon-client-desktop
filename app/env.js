const fs = require('graceful-fs');
const path = require('path');

const envPath = path.join(__dirname, 'env.json');
let env;

try {
  env = require(envPath);
} catch(e) {
  env = {name: 'production'};
}

module.exports = env;
