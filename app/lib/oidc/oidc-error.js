/**
 * @param {string} message - error message
 * @param {string} [code] - error code. Default: `E_BLN_OIDC_UNDEFINED`
 */
module.exports = function OidcError(message, code) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.code = code || 'E_BLN_OIDC_UNDEFINED';
};

require('util').inherits(module.exports, Error);
