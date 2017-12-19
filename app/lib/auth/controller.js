const fs = require('graceful-fs');
const path = require('path');

const {session} = require('electron');

const OidcCtrl = require('../oidc/controller.js');
const StartupCtrl = require('../../ui/startup/controller.js');
const logger = require('../logger.js');
const instance = require('../instance.js');
const fsUtility = require('../fs-utility.js');
const syncFactory = require('@gyselroth/balloon-node-sync');

module.exports = function(env, clientConfig) {
  var oidc = OidcCtrl(env, clientConfig);

  function logout() {
    logger.info('logout initialized', {category: 'auth'});

    return new Promise(function(resolve, reject) {
      if(clientConfig.get('authMethod') === 'oidc' && clientConfig.get('oidcProvider')) {
        var idpConfig = getIdPByProviderUrl(clientConfig.get('oidcProvider'));

        if(!idpConfig) {
          logger.error("refreshToken can not be revoked, oidc configuration is not available anymore", {
            category: 'auth',
            oidcProvider: clientConfig.get('oidcProvider')
          });
        } else {
          oidc.revokeToken(idpConfig);
        }
      }

      var _logout = function() {
        clientConfig.set('authMethod', undefined);
        clientConfig.updateTraySecret();
        instance.unlink(clientConfig);
        resolve();
      };

      clientConfig.destroySecret(clientConfig.getSecretType()).then(_logout
      ).catch(error => {
        logger.error("failed to destroy secret, but user gets logged out anyways", {
          category: 'auth',
          error: error
        });

        _logout();
      })
   });
  }

  function basicAuth(username, password) {
    clientConfig.set('authMethod', 'basic');
    clientConfig.set('username', username);

    return new Promise(function(resolve, reject){
      clientConfig.storeSecret('password', password).then(() => {
        verifyNewLogin().then((username) => {
          resolve();
        }).catch((error) => {
          logger.error('failed signin via basic auth', {
            category: 'auth',
            error: error
          });

          reject(error)
        });
      }).catch((error) => {
        logger.error('failed store secret in keystore', {
          category: 'auth',
          error: error
        });

        reject(error)
      });
    });
  }

  function refreshAccessToken() {
    return new Promise(function(resolve, reject) {
      var oidcProvider = clientConfig.get('oidcProvider');
      if(oidcProvider === undefined) {
        logger.error('no oidc provider set', {category: 'auth'});
        return reject();
      } else {
        var idpConfig = getIdPByProviderUrl(oidcProvider);
      }

      oidc.signin(idpConfig).then((authorization) => {
        if(authorization === true)  {
          logger.error('can not accept new authorization after refresh access_token', {
            category: 'auth',
          });

          reject()
        } else {
          verifyAuthentication().then((username) => {
            resolve();
          }).catch((error) => {
            logger.error('failed refresh access_token', {
              category: 'auth',
              error: error
            });

            reject(error)
          });
        }
      });
    });
  }

  function oidcAuth(idpConfig) {
    return new Promise(function(resolve, reject) {
      oidc.signin(idpConfig).then((authorization) => {
        if(authorization === true)  {
          verifyNewLogin().then((username) => {
            resolve();
          }).catch((error) => {
            clientConfig.set('oidcProvider', undefined);
            logger.error('failed signin new authorization via oidc', {
              category: 'auth',
              error: error
            });

            reject(error)
          });
        } else {
          verifyAuthentication().then((username) => {
            resolve();
          }).catch((error) => {
            clientConfig.set('oidcProvider', undefined);
            logger.error('failed signin via oidc', {
              category: 'auth',
              error: error
            });

            reject(error)
          });
        }
      });
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

        if(err.code !== 'E_BLN_API_REQUEST_UNAUTHORIZED') {
          // assume there is a network problem, should retry later
          return reject(err);
        }

        if(clientConfig.get('authMethod') === 'oidc') {
          var oidcProvider = clientConfig.get('oidcProvider');

          if(oidcProvider === undefined) {
            logger.info('login no oidc provider, open startup configuration', {category: 'auth'});
            startup().then(resolve).catch(reject);
          } else {
            var idpConfig = getIdPByProviderUrl(oidcProvider);
            oidcAuth(idpConfig).then(resolve).catch((err) => {
              logger.info('login oidc login failed, open startup configuration', {
                category: 'auth',
                error: err
              });

              startup().then(resolve).catch(reject);
            });
          }
        } else {
          logger.info('login method not oidc, starting startup configuration', {category: 'auth'});
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

      if((config.authMethod === 'oidc' && !config.accessToken) || (config.authMethod === 'basic' && !config.password)) {
        logger.error('can not verify credentials, no secret available', {category: 'auth'});
        reject(new Error('Secret not set'));
      }

      var sync = syncFactory(config, logger);

      logger.info('verify authentication via whoami api call', {
        category: 'auth',
        authMethod: config.authMethod,
        username: config.username
      });

      sync.blnApi.whoami(function(err, username) {
        if(err) {
          logger.info('verify authentication failed', {
            category: 'auth',
            error: err,
            username: username
          });

          clientConfig.set('loggedin', false);
          reject(err);
        } else {
          logger.info('successfully verifed user credentials', {
            category: 'auth',
            username: username
          });

          clientConfig.set('loggedin', true);
          resolve();
        }
      });
    });
  }

  function verifyNewLogin(oldUser, newUser) {
    return new Promise(function(resolve, reject) {
      var sync = syncFactory(clientConfig.getAll(true), logger);
      sync.blnApi.whoami(function(err, username) {
        if(err) {
          logger.error('failed verify new user credentials', {
            category: 'auth',
            error: err
          });

          clientConfig.set('oidcProvider', undefined);
          return reject(err);
        }

        logger.info('successfully verified authentication', {
          category: 'auth',
          username: username
        });

        clientConfig.set('loggedin', true);
        clientConfig.set('username', username);

        if(!instance.getInstances()) {
          instance.setNewInstance(clientConfig);
          resolve();
        } else {
          var instanceName = instance.getInstance(clientConfig);

          if(instanceName === instance.getLastActiveInstance()) {
            instance.loadInstance(instanceName, clientConfig);
            resolve();
          } else {
            instance.archiveDataDir(clientConfig).then(() => {
              if(instanceName === null) {
                instance.setNewInstance(clientConfig);
                clientConfig.set('loggedin', true);
                resolve();
              } else {
                instance.loadInstance(instanceName, clientConfig).then(() => {
                  resolve();
                  clientConfig.set('loggedin', true);
                }).catch((error) => {
                  reject(error);
                });
              }
            }).catch((error) => {
              reject(error);
            });
          }
        }
      });
    });
  }

  return {
    logout,
    login,
    basicAuth,
    oidcAuth,
    refreshAccessToken,
    getIdPByProviderUrl,
    retrieveLoginSecret
  }
}
