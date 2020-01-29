const fs = require('graceful-fs');
const os = require('os');
const path = require('path');

const {session} = require('electron');

const OidcCtrl = require('../oidc/controller.js');
const logger = require('../logger.js');
const instance = require('../instance.js');
const fsUtility = require('../fs-utility.js');
const {fullSyncFactory} = require('@gyselroth/balloon-node-sync');
const globalConfig = require('../global-config.js');
const request = require('request');
const AuthError = require('./auth-error.js');

module.exports = function(env, clientConfig) {
  var oidc = OidcCtrl(env, clientConfig);

  function logout() {
    logger.info('logout initialized', {category: 'auth', authMethod: clientConfig.get('authMethod')});

    return new Promise(function(resolve, reject) {
      var _finalizeLogout = function() {
        clientConfig.set('authMethod', undefined);
        clientConfig.updateTraySecret();
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

      if(clientConfig.get('authMethod') === 'oidc' && clientConfig.get('oidcProvider')) {
        var idpConfig = getIdPByProviderUrl(clientConfig.get('oidcProvider'));

        if(!idpConfig) {
          logger.error("refreshToken can not be revoked, oidc configuration is not available anymore", {
            category: 'auth',
            oidcProvider: clientConfig.get('oidcProvider')
          });

          _logout(false);
        } else {
          oidc.revokeToken(idpConfig).then(()=>_logout(false)).catch(()=>_logout(false));
        }
      } else {
        _logout(clientConfig.get('authMethod') === 'basic');
      }
   });
  }

  function credentialsAuth(username, password, code) {
    if(!env.auth) {
      return _doTokenAuth(username, password, code);
    }

    switch(env.auth.credentials) {
      case null:
        return Prmosie.reject(new Error('Credentials authentication has been deactivated.'));
      break;
      case 'basic':
        return _doBasicAuth(username, password);
      break;
      case 'token':
      default:
        return _doTokenAuth(username, password, code);
      break;

    }
  }

  function _doBasicAuth(username, password) {
    clientConfig.set('authMethod', 'basic');
    clientConfig.set('username', username);

    return new Promise(function(resolve, reject){
      clientConfig.storeSecret('password', password).then(() => {
        verifyNewLogin().then(resolve).catch((error) => {
          logger.error('failed signin via basic auth', {
            category: 'auth',
            error: error
          });

          reject(error);
        });
      }).catch((error) => {
        logger.error('failed store secret in keystore', {
          category: 'auth',
          error: error
        });

        reject(error);
      });
    });
  }

  function _doTokenAuth(username, password, code) {
    clientConfig.set('authMethod', 'token');
    clientConfig.set('username', username);

    return new Promise(function(resolve, reject){
      var apiUrl = clientConfig.get('apiUrl').replace('/v1', '/v2');

      var body = {
        username: username,
        password: password,
        grant_type: 'password',
      };

      if(code && code !== '') {
        body.grant_type = 'password_mfa';
        body.code = code;
      }

      logger.info('Do token auth', {category: 'auth', username: body.username, grant_type: body.grant_type});
      var reqOptions = {
        uri: apiUrl + 'tokens',
        method: 'POST',
        headers: {
          'X-Client': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname()].join('|'),
          'User-Agent': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname(), os.platform(), os.release()].join('|'),
          'Authorization': 'Basic ' + new Buffer('balloon-client-desktop:').toString('base64')
        },
        form: body,
        json: true,
        timeout: clientConfig.get('requestTimeout') || 30000
      };

      var req = request(reqOptions, (err, response, body) => {
        if(err) {
          logger.error('do token auth failed', {category: 'auth', error: err});

          return reject(err);
        }

        switch(response.statusCode) {
          case 200:
            _storeAuthTokens(body)
              .then(() => {
                verifyNewLogin().then(resolve).catch((error) => {
                  logger.error('failed signin via token auth', {
                    category: 'auth',
                    error: error
                  });

                  reject(error);
                });
              })
              .catch(reject);
          break;
          case 403:
            if(body.error === 'Balloon\\App\\Idp\\Exception\\MultiFactorAuthenticationRequired') {
              var error = new Error('MFA auth required');
              error.code = 'E_BLN_MFA_REQUIRED';
              reject(error);
            } else {
              reject(body);
            }
          break;
          case 401:
          default:
            reject(new Error(body.error_description));
          break;
        }
      });
    });
  }

  function _storeAuthTokens(body) {
    return new Promise(function(resolve, reject) {
      if(!body.access_token) {
        logger.error('access token not set in response', {category: 'auth'});
        return reject(new Error('Response does not contain access_token'));
      }

      var promises = [];

      promises.push(clientConfig.storeSecret('accessToken', body.access_token));

      if(body.refresh_token) {
        promises.push(clientConfig.storeSecret('refreshToken', body.refresh_token))
      }

      Promise.all(promises).then(() => {
        logger.debug('Stored tokens', {category: 'auth'});
        resolve();
      }).catch((err) => {
        logger.error('Could not store tokens', {category: 'auth', err});
        reject(err);
      });
    });
  }

  function refreshAccessToken() {
    var authMethod = clientConfig.get('authMethod');

    switch(authMethod) {
      case 'oidc':
        return _refreshOidcAccessToken();
      break;
      case 'token':
        return _refreshInternalAccessToken();
      break;
      default:
        return Promise.reject(new Error('refresh acess token for method "'+ authMethod + '" not implemented.'));
      break;
    }
  }

  function _refreshOidcAccessToken() {
    return new Promise(function(resolve, reject) {
      var oidcProvider = clientConfig.get('oidcProvider');
      if(oidcProvider === undefined) {
        logger.error('no oidc provider set', {category: 'auth'});
        return reject();
      } else {
        var idpConfig = getIdPByProviderUrl(oidcProvider);
      }

      oidc.refreshAccessToken(idpConfig).then(() => {
        verifyAuthentication().then(resolve).catch((error) => {
          logger.error('failed refresh access_token', {
            category: 'auth',
            error: error
          });

          reject(error);
        });
      }).catch(reject);
    });
  }

  function _refreshInternalAccessToken() {
    return new Promise(function(resolve, reject) {
      clientConfig.retrieveSecret('refreshToken')
        .then((secret) => {
          var apiUrl = clientConfig.get('apiUrl').replace('/v1', '/v2');
          var reqOptions = {
            uri: apiUrl + 'tokens',
            method: 'POST',
            headers: {
              'X-Client': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname()].join('|'),
              'User-Agent': ['Balloon-Desktop-App', globalConfig.get('version'), os.hostname(), os.platform(), os.release()].join('|'),
              'Authorization': 'Basic ' + new Buffer('balloon-client-desktop:').toString('base64')
            },
            body: {
              refresh_token: secret,
              grant_type: 'refresh_token',
            },
            json: true,
            timeout: clientConfig.get('requestTimeout') || 30000
          };

          var req = request(reqOptions, (err, response, body) => {
            if(err) {
              logger.error('refresh internal access token failed', {category: 'auth', error: err});

              if(err.code && isNetworkError(err.code)) {
                err = new AuthError(err.message, 'E_BLN_AUTH_NETWORK');
              }

              return reject(err);
            }

            switch(response.statusCode) {
              case 200:
                _storeAuthTokens(body)
                  .then(() => {
                    verifyAuthentication().then(resolve).catch((error) => {
                      logger.error('verify auth after refresh access token failed', {
                        category: 'auth',
                        error: error
                      });

                      reject(error);
                    });
                  })
                  .catch(reject);
              break;
              case 400:
              default:
                reject(new Error(body.error_description));
              break;
            }
          });
        })
        .catch((err) => {
          logger.error('Could not retrieve internal refresh token', {category: 'auth', err});
          reject(err)
        });
    });
  }

//TODO pixtron - iss-168 unify verifyNewLogin and verifyAuthentication
//TODO pixtron - we can remove these? clientConfig.set('oidcProvider', undefined);
  function oidcAuth(idpConfig) {
    return new Promise(function(resolve, reject) {
      oidc.signin(idpConfig).then(() => {
        verifyNewLogin().then(resolve).catch((error) => {
          clientConfig.set('oidcProvider', undefined);
          logger.error('failed to authorize via oidc', {category: 'auth', error});

          reject(error)
        });
      }).catch(reject);
    });
  }

  function retrieveLoginSecret() {
    return new Promise(function(resolve) {
      if(!clientConfig.get('authMethod')) {
        logger.info('no authentication method set yet', {category: 'auth'});
        return resolve();
      }

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
      verifyAuthentication().then(resolve).catch((err) => {
        logger.info('login failed', {
          category: 'auth',
          error: err
        });

        if(err.code && ['E_BLN_API_REQUEST_UNAUTHORIZED', 'E_BLN_API_REQUEST_MFA_REQUIRED'].includes(err.code) === false) {
          // assume there is a network problem, should retry later
          return reject(err);
        }

        var authMethod = clientConfig.get('authMethod');
        switch(authMethod) {
          case 'oidc':
          case 'token':
            refreshAccessToken().then(resolve).catch((error) => {
              logger.info('login failed, open startup configuration', {
                category: 'auth',
                authMethod: authMethod,
                error: err
              });

              startup().then(resolve).catch(reject);
            });
          break;
          default:
            logger.info('login method neither oidc or token, starting startup configuration', {category: 'auth'});
            startup().then(resolve).catch(reject);
        }
      });
    });
  }

  function getIdPByProviderUrl(providerUrl) {
    if(!env.auth || !env.auth.oidc) {
      return undefined;
    }

    for(var i=0; i<env.auth.oidc.length; i++) {
      if(env.auth.oidc[i].providerUrl === providerUrl) {
        return env.auth.oidc[i];
      }
    }

    return undefined;
  }

  function verifyAuthentication() {
    return new Promise(function(resolve, reject) {
      var config = clientConfig.getAll(true);

      if((['oidc', 'token'].includes(config.authMethod) && !config.accessToken) || (config.authMethod === 'basic' && !config.password)) {
        logger.error('can not verify credentials, no secret available', {category: 'auth'});
        reject(new Error('Secret not set'));
      }

      logger.info('verify authentication via whoami api call', {
        category: 'auth',
        authMethod: config.authMethod,
        username: config.username
      });

      whoami().then(resolve).catch(reject);
    });
  }

  function verifyNewLogin() {
    //resolves with boolean true if a new instance was created (aka never seen user)
    return new Promise(function(resolve, reject) {
      logger.info('verifying new user credentials with whoami call');
      whoami().then(username => {
        var url = clientConfig.get('blnUrl');
        var context = clientConfig.get('context');

        instance.link(username, url, context, clientConfig).then(newInstance => {
          //only change username after instance has been loaded, otherwise we might change the username in an old instance
          clientConfig.set('username', username);
          clientConfig.set('loggedin', true);
          resolve(newInstance);
        }).catch(err => {
          clientConfig.set('loggedin', false);
          reject(err);
        });
      }).catch(error => {
        clientConfig.set('oidcProvider', undefined);
        return reject(error);
      });
    });
  }

  function whoami() {
    return new Promise((resolve, reject) => {
      var config = clientConfig.getAll(true);
      config.version = globalConfig.get('version');

      var sync = fullSyncFactory(config, logger);

      sync.blnApi.whoami(function(error, username) {
        if(error) {
          logger.info('whoami failed', {category: 'auth', error, username});

          clientConfig.set('loggedin', false);

          if(error.code && isNetworkError(error)) {
            error = new AuthError(error.message, 'E_BLN_AUTH_NETWORK');
          } else if(error.code && error.code !== 'E_BLN_API_REQUEST_UNAUTHORIZED') {
            error = new AuthError(error.message, 'E_BLN_AUTH_SERVER');
          }

          reject(error);
        } else {
          logger.info('whoami successfull', {category: 'auth', username});

          clientConfig.set('loggedin', true);
          resolve(username);
        }
      });
    });
  }

  function isNetworkError(error) {
    return [
      'ENOTFOUND',
      'ETIMEDOUT',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'ECONNREFUSED',
      'EHOSTDOWN',
      'ESOCKETTIMEDOUT',
      'ECONNRESET'
    ].includes(error.code);
  }

  return {
    logout,
    login,
    credentialsAuth,
    oidcAuth,
    refreshAccessToken,
    retrieveLoginSecret
  }
}
