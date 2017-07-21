'use strict';

const fs = require('graceful-fs');
const path = require('path');

const gulp = require('gulp');
const utils = require('./utils');

gulp.task('build', function () {
    var srcPath = path.join(__dirname, '../config/', 'env_' + utils.getEnvName() + '.json');
    var destPath = path.join(__dirname, '../app/', 'env.json');

    if(!fs.existsSync(srcPath)) {
      throw new Error('Config does not exists, please create it at: ' + srcPath);
    }

    if(fs.existsSync(destPath)) {
      fs.truncateSync(destPath, 0);
    }

    fs.createReadStream(srcPath).pipe(fs.createWriteStream(destPath));
});
