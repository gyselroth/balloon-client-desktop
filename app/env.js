const fs = require('graceful-fs');
const path = require('path');

const envPath = path.join(__dirname, 'env.json');
const env = require(envPath);

module.exports = env;
