const fs = require('graceful-fs');
const os = require('os');
const path = require('path');

const {session} = require('electron');

const OidcCtrl = require('../oidc/controller.js');
const logger = require('../logger.js');
const instance = require('../instance.js');
const fsUtility = require('../fs-utility.js');
const globalConfig = require('../global-config.js');
const request = require('request');
const appState = require('../state.js');
const AuthError = require('./auth-error.js');
const { CoreV3Api, OAuth } = require('@gyselroth/balloon-sdk-node');

module.exports = function(env, clientConfig) {
  var oidc = OidcCtrl(env, clientConfig);

  var idpConfig = {
    clientId: "balloon-client-desktop",
    providerUrl: clientConfig.get('blnUrl'),
    redirectUri: "http://127.0.0.1:13006",
    scope: "openid offline",
  };

  function logout(clientInitiated) {
    logger.info('logout initialized', {category: 'auth'});

    return new Promise(function(resolve, reject) {
      var _finalizeLogout = function() {
        clientConfig.updateTraySecret();
        appState.set('clientInitiatedLogout', clientInitiated);
        instance.unlink(clientConfig);

        resolve();
      }

      var _logout = function(excludeRefreshToken) {
        logger.info('Destroying secrets', {category: 'auth', excludeRefreshToken});

        var promises = [];

        promises.push(clientConfig.destroySecret(clientConfig.getSecretType()));

        if(excludeRefreshToken !== true) {
         promises.push(clientConfig.destroySecret('refreshToken'));
        }

        Promise.all(promises)
          .then(_finalizeLogout)
          .catch(error => {
            logger.error("failed to destroy secret(s?), but user gets logged out anyways", {
              category: 'auth',
              error: error
            });

            _finalizeLogout();
          });
      };

      oidc.revokeToken(idpConfig).then(()=>_logout(false)).catch(()=>_logout(false));
   });
  }

  function _storeOidcAuthTokens(response) {
    return new Promise((resolve, reject) => {
      if(!response.accessToken) {
        logger.error('access token not set in oidc response', {category: 'auth'});
        return reject(new Error('Response does not contain accessToken'));
      }

      var promises = [];

      promises.push(clientConfig.storeSecret('accessToken', response.accessToken));

      if(response.refreshToken) {
        promises.push(clientConfig.storeSecret('refreshToken', response.refreshToken))
      }

      Promise.all(promises).then(() => {
        logger.debug('Stored oidc tokens', {category: 'auth'});
        resolve();
      }).catch((err) => {
        logger.error('Could not store oidc tokens', {category: 'auth', err});
        reject(err);
      });
    });
  }

  function refreshAccessToken() {
    logger.info('Refreshing access token', {category: 'auth'});

    return new Promise(function(resolve, reject) {
      oidc.refreshAccessToken(idpConfig).then(response => {
        var config = {
          accessToken: response.accessToken
        };

        verifyAuthentication(config).then(() => {
          clientConfig.set('accessTokenExpires', response.issuedAt + response.expiresIn);
          _storeOidcAuthTokens(response).then(resolve).catch(reject);
        }).catch((error) => {
          logger.error('failed refresh access_token', { category: 'auth', error: error});

          reject(error);
        });
      }).catch(reject);
    });
  }

  function oidcAuth() {
    return new Promise(function(resolve, reject) {
      idpConfig.providerUrl = clientConfig.get('blnUrl');

      oidc.signin(idpConfig).then((result) => {
        var config = {
          accessToken: result.accessToken
        };

        verifyAuthentication(config).then(() => {
          clientConfig.set('accessTokenExpires', result.issuedAt + result.expiresIn);

          _storeOidcAuthTokens(result).then(resolve).catch(reject);
        }).catch((error) => {
          logger.error('failed to authorize via oidc', {category: 'auth', error});

          reject(error)
        });
      }).catch(reject);
    });
  }

  function retrieveLoginSecret() {
    return new Promise(function(resolve) {
      clientConfig.retrieveSecret(clientConfig.getSecretType()).then((secret) => {
        clientConfig.setSecret(secret)
        resolve();
      }).catch((error) => {
        logger.error('failed retrieve secret from keystore', {
          category: 'auth',
          error: error
        });

        resolve();
      })
    });
  }

  function login(startup) {
    logger.info('login initialized', {category: 'auth'});

    return new Promise(function (resolve, reject) {
      var config = {};
      config.accessToken = clientConfig.getSecret();

      verifyAuthentication(config).then(resolve).catch((err) => {
        logger.info('login failed', { category: 'auth', error: err});

        if(err.code && ['E_BLN_API_REQUEST_UNAUTHORIZED', 'E_BLN_API_REQUEST_MFA_REQUIRED'].includes(err.code) === false) {
          // assume there is a network problem, should retry later
          return reject(err);
        }

        refreshAccessToken().then(resolve).catch((error) => {
          if(['E_BLN_AUTH_NETWORK', 'E_BLN_OIDC_NETWORK', 'E_BLN_AUTH_SERVER', 'E_OIDC_AUTH_SERVER'].includes(error.code)) {
            //network or temporary server error, should retry later
            logger.info('login failed with temporary error', {category: 'auth', error});
            reject(error);
          } else {
            logger.info('login failed, open startup configuration', { category: 'auth', error});

            startup().then(resolve).catch(reject);
          }
        });
      });
    });
  }

  function verifyAuthentication(config) {
    //resolves with boolean true if a new instance was created (aka never seen user)
    return new Promise(function(resolve, reject) {
      if(!config.accessToken) {
        logger.error('can not verify credentials, no secret available', {category: 'auth'});
        reject(new Error('Secret not set'));
      }

      logger.info('verifying new user credentials with whoami call', {category: 'auth'});

      //TODO move to own module
      var url = clientConfig.get('blnUrl');
      var client = new CoreV3Api(url);
      var bearer = new OAuth();
      bearer.accessToken = config.accessToken;
      client.setDefaultAuthentication(bearer);

      client.getCoreV3CurrentUser().then(response => {
        var context = clientConfig.get('context');

        instance.link(response.body.username, url, context, clientConfig).then(newInstance => {
          if(!response.body.username) {
            throw new Error('no username found in response');
          }

          //only change username after instance has been loaded, otherwise we might change the username in an old instance
          clientConfig.set('username', response.body.username);
          clientConfig.set('loggedin', true);
          resolve(newInstance);
        }).catch(err => {
          clientConfig.set('loggedin', false);
          reject(err);
        });
      }).catch(err => {
        clientConfig.set('loggedin', false);
        reject(err);
      });
    });
  }

  function _isNetworkError(error) {
    return [
      'ENOTFOUND',
      'ETIMEDOUT',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'ECONNREFUSED',
      'EHOSTDOWN',
      'ESOCKETTIMEDOUT',
      'ECONNRESET',
      'E_BLN_API_REQUEST_NETWORK'
    ].includes(error.code);
  }

  function _checkForNetworkAndServerErrors(error) {
    if(error.code && _isNetworkError(error)) {
      return new AuthError(error.message, 'E_BLN_AUTH_NETWORK');
    }

    if(error.code && error.code !== 'E_BLN_API_REQUEST_UNAUTHORIZED') {
      return new AuthError(error.message, 'E_BLN_AUTH_SERVER');
    }

    return error;
  }

  return {
    logout,
    login,
    oidcAuth,
    refreshAccessToken,
    retrieveLoginSecret
  }
}
