const fs = require('graceful-fs');
const path = require('path');

const {session} = require('electron');

const OidcCtrl = require('../../ui/oidc/controller.js');
const StartupCtrl = require('../../ui/startup/controller.js');
const OauthCtrl = require('../../ui/oauth/controller.js');
const logger = require('../logger.js');
const instance = require('../instance.js');
const fsUtility = require('../fs-utility.js');
const syncFactory = require('@gyselroth/balloon-node-sync');

module.exports = function(env, clientConfig) {
  //TODO oauth deprecated, remove after oidc migration
  var oauth = OauthCtrl(env, clientConfig);
  var oidc = OidcCtrl(env, clientConfig);

  function isLoggedIn() {
    return clientConfig.get('loggedin')
  }

  function logout() {
    logger.info('AUTH: logout initialized');

    return new Promise(function(resolve, reject) {
      clientConfig.destroySecret(clientConfig.getSecretType()).then(() => {
        instance.unlink(clientConfig);
        resolve();
      }).catch((error) => {
        logger.error("failed to destroy secret, but user gets logged out anyways", {error})
        instance.unlink(clientConfig);
        resolve();
      })

      //TODO raffis - logout needs to be reviewd after oauth gets removed (oidc replacement)
      //TODO raffis - https://github.com/openid/AppAuth-JS/issues/17
      //AppAuth doesnt fetch the revoke endpoint from the discovery, maybe fork&fix
    });
  }
  
  function basicAuth(username, password) {
    var oldUser = clientConfig.get('username');
    clientConfig.set('authMethod', 'basic');
    clientConfig.set('username', username);
    
    return new Promise(function(resolve, reject){
      clientConfig.storeSecret('password', password).then(() => {
        verifyNewLogin(oldUser, username).then((username) => {
          if(oldUser === undefined || oldUser !== username) {
            resolve(username); 
          } else {
            resolve();
          }
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
      var oldUser = clientConfig.get('username');
      //TODO raffis - backwards compatibility, gets removed soon
      if(idpConfig.responseType === 'token') {
        return oauth.signin(idpConfig).then(() => {
          verifyNewLogin(oldUser).then((username) => {
            if(oldUser === undefined || oldUser !== username) {
              resolve(username); 
            } else {
              resolve();
            }
          });
        }).catch((error) => {
          reject(error);
        });
      }
    
      oidc.signin(idpConfig).then((authorization) => {
        if(authorization === true)  {
          verifyNewLogin(oldUser).then((username) => {
            if(oldUser === undefined || oldUser !== username) {
              resolve(username); 
            } else {
              resolve();
            }
          }).catch((error) => {
            logger.error('AUTH: failed signin via oidc', {error});
            reject(error)
          });
        } else {
          resolve();
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
      verifyAuthentication().then(() => {
        return resolve();  
      }).catch((err) => {
        if(clientConfig.get('authMethod') === 'oidc') {
          var oidcProvider = clientConfig.get('oidcProvider');
          if(oidcProvider === undefined) {
            startup().then(() => {
              resolve();
            });
          } else {
            var idpConfig = getIdPByName(oidcProvider);
            startup().then(() => {
              resolve();
            });
          }
        } else {
          startup().then(() => {
            resolve();
          });
        }
      });
    });
  }     
 
  function getIdPByName(name) {
    for(var i=0; i<env.auth.oidc.length; i++) {
      if(env.auth.oidc[i].provider === name) {
        return env.auth.oidc[i];
      }
    }

    return undefined;
  }

  function verifyAuthentication() {
    return new Promise(function(resolve, reject) {
      var sync = syncFactory(clientConfig.getAll(true), logger);
      sync.blnApi.whoami(function(err, username) {
        if(err) {
          clientConfig.set('loggedin', false);
          reject(err);
        } else {
          clientConfig.set('loggedin', true);
          resolve();
        }
      });
    });
  }

  function verifyNewLogin(oldUser, newUser) {
    return new Promise(function(resolve, reject) {
      var config = clientConfig.getAll(true);
      config.username = newUser;      
      var sync = syncFactory(config, logger);
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
    isLoggedIn,
    basicAuth,
    oidcAuth, 
    getIdPByName,
    retrieveLoginSecret
  }
}
