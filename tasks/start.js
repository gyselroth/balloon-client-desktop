'use strict';

const childProcess = require('child_process');
const electron = require('electron');
const gulp = require('gulp');

gulp.task('start', gulp.parallel(['build'], function (done) {
    childProcess.spawn(electron, ['.'], {
        stdio: 'inherit'
    })
    .on('close', function () {
      // User closed the app. Kill the host process.
      done();
    });
}));
