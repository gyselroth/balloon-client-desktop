const fs = require('graceful-fs');
const path = require('path');

const electron = require('electron');
const app = electron.app || electron.remote.app;

const defaultLocales = {
  'de': 'de-CH',
  'en': 'en-US',
  '*': 'en-US'
};

var translations;
var currentLocale;


function changeLanguage(locale) {
  //do not load localizations if already loaded
  if(currentLocale === locale) return locale;

  var pathLocalizationFile = path.join(__dirname, '..', 'i18n', locale + '.json');

  if(fs.existsSync(pathLocalizationFile) === false) {
    locale = getDefaultLocale(locale);
    var pathLocalizationFile = path.join(__dirname, '..', 'i18n', locale + '.json');
  }

  currentLocale = locale;

  translations = require(pathLocalizationFile);

  return locale;
};

function getDefaultLocale(locale) {
  return defaultLocales[locale] || defaultLocales['*'];
}

function getTranslation(key) {
  return translations[key] || key;
}

function getCurrentLocale() {
  return currentLocale
}

//initialize localisations
if(app.isReady()) {
  changeLanguage(app.getLocale());
} else {
  app.on('ready', function() {
    changeLanguage(app.getLocale());
  });
}

module.exports = {
  '__': getTranslation,
  changeLanguage,
  getCurrentLocale
};
