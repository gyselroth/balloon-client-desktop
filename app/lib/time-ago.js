const timeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
const de = require('javascript-time-ago/locale/de');

timeAgo.addLocale(en);

module.exports = new timeAgo('en');
