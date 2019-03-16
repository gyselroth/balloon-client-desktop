const keytar = require('keytar');
const maxRetries = 5;
const retryTimeOut = 100;

const pause = function(duration) {
  return new Promise(function(resolve) {
    setTimeout(resolve, duration);
  });
}

const backoff = function(fn, retries) {
  return new Promise(function(resolve, reject) {
    fn().then(resolve).catch(function(err) {
      if(retries === undefined) retries = 0;

      if(retries < maxRetries) {
        retries ++;
        pause(retries * retryTimeOut).then(function() {
          backoff(fn, retries).then(resolve).catch(reject);
        });
      } else {
        reject(err);
      }
    });
  });
}

module.exports = {
  delete: function(type) {
    return backoff(function() {
      return keytar.deletePassword('balloon', type);
    });
  },

  set: function(type, key) {
    return backoff(function() {
      return keytar.setPassword('balloon', type, key);
    });
  },

  get: function(type) {
    return backoff(function() {
      return keytar.getPassword('balloon', type);
    });
  }
}
