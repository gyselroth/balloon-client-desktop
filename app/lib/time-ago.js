const timeAgo = require('javascript-time-ago');
const en = require('javascript-time-ago/locale/en');
const de = require('javascript-time-ago/locale/de');

const i18n = require('./i18n.js');

timeAgo.addLocale(en);
timeAgo.addLocale(de);



module.exports = new timeAgo(i18n.getCurrentLocale());
