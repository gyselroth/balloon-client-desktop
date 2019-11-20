/**
 * @param {string} message - error message
 * @param {string} [code] - error code. Default: `E_BLN_AUTH_UNDEFINED`
 */
module.exports = function AuthError(message, code) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.code = code || 'E_BLN_AUTH_UNDEFINED';
};

require('util').inherits(module.exports, Error);
