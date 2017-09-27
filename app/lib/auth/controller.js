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
    logger.info('AUTH: logout initialized');

    return new Promise(function(resolve, reject) {
      if(clientConfig.get('authMethod') === 'oidc' && clientConfig.get('oidcProvider')) {
        oidc.revokeToken(getIdPByProviderUrl(clientConfig.get('oidcProvider')));
      }

      var _logout = function() {
        clientConfig.set('authMethod', undefined);
        clientConfig.updateTraySecret();
        instance.unlink(clientConfig);
        resolve();
      };
      
      clientConfig.destroySecret(clientConfig.getSecretType()).then(_logout
      ).catch(error => {
        logger.error("failed to destroy secret, but user gets logged out anyways", {error})
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
          logger.error('AUTH: failed signin via basic auth', {error});
          reject(error)
        });
      }).catch((error) => {
        logger.error('AUTH: failed store secret in keystore', {error});
        reject(error)
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
            logger.error('AUTH: failed signin new authorization via oidc', {error});
            reject(error)
          });
        } else {
          verifyAuthentication().then((username) => {
            resolve();
          }).catch((error) => {
            clientConfig.set('oidcProvider', undefined);
            logger.error('AUTH: failed signin via oidc', {error});
            reject(error)
          });
        }
      });
    });
  } 
  
  function retrieveLoginSecret() {
    return new Promise(function(resolve) {
      if(!clientConfig.get('authMethod')) {
        logger.info('AUTH: no authentication method set yet');
        return resolve();
      }

      clientConfig.retrieveSecret(clientConfig.getSecretType()).then((secret) => {
        clientConfig.setSecret(secret)
        resolve();
      }).catch((error) => {
        logger.error('AUTH: failed retrieve secret from keystore', {error});
        resolve();
      })
    });
  }

  function login(startup) {
    logger.info('AUTH: login initialized');
    return new Promise(function (resolve, reject) {
      verifyAuthentication().then(resolve).catch((err) => {
        logger.info('AUTH: login failed', {code: err.code, message: err.message, stack: err.stack});

        if(clientConfig.get('authMethod') === 'oidc') {
          var oidcProvider = clientConfig.get('oidcProvider');

          if(oidcProvider === undefined) {
            logger.info('AUTH: login no oidc provider, open startup configuration');
            startup().then(resolve).catch(reject);
          } else {
            var idpConfig = getIdPByProviderUrl(oidcProvider);
            oidcAuth(idpConfig).then(resolve).catch((err) => {
              logger.info('AUTH: login oidc login failed, open startup configuration', {err});

              startup().then(resolve).catch(reject);
            });
          }
        } else {
          logger.info('AUTH: login method not oidc, starting startup configuration');
          startup().then(resolve).catch(reject);
        }
      });
    });
  }

  function getIdPByProviderUrl(providerUrl) {
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
        logger.error('AUTH: verifyAuthentication secret not set');
        reject(new Error('Secret not set'));
      }

      var sync = syncFactory(config, logger);

      logger.info('AUTH: verifyAuthentication', {authMethod: config.authMethod, username: config.username});

      sync.blnApi.whoami(function(err, username) {
        if(err) {
          logger.info('AUTH: verifyAuthentication whoami failed', {err, username});
          clientConfig.set('loggedin', false);
          reject(err);
        } else {
          logger.info('AUTH: verifyAuthentication whoami successfull', {username});
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
          logger.error('failed verify authentication', {err});
          clientConfig.set('oidcProvider', undefined);
          return reject(err);
        }
 
        logger.info('successfully verified authentication', {username});
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
    getIdPByProviderUrl,
    retrieveLoginSecret
  }
}
