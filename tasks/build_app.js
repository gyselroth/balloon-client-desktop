'use strict';

const fs = require('graceful-fs');
const path = require('path');

const gulp = require('gulp');
const utils = require('./utils');

gulp.task('build', function () {
    var envName = utils.getEnvName();
    var srcPath = path.join(__dirname, '../config/', `env_${envName}.json`);
    var destPath = path.join(__dirname, '../resources/', 'env.json');

console.log(srcPath);
    if(fs.existsSync(srcPath)) {
      if(fs.existsSync(destPath)) {
        fs.truncateSync(destPath, 0);
      }
console.log(destPath);
      fs.createReadStream(srcPath).pipe(fs.createWriteStream(destPath));
    } else if(envName !== 'production') {
      fs.writeFile(destPath, '{"name": "'+envName+'"}', function(err) {
        if(err) {
          throw err;
        }
      });
    }
});
