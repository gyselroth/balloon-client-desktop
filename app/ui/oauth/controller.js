//TODO backwards compatibility, this module gets removed soon!

/**
* This module was heavily inspired by https://github.com/jvitor83/electron-oauth2/blob/master/index.js
**/

const {BrowserWindow, protocol, session} = require('electron');
const queryString = require('querystring');
const request = require('request');
const extend = require('util')._extend;

const logger = require('../../lib/logger.js');
const windowStatesFactory = require('../window-states.js');
const syncFactory = require('@gyselroth/balloon-node-sync');



module.exports = function (env, clientConfig) {
  var oauthConfig = env.oAuth2Config;
  var authWindow = null;

  windowStates = windowStatesFactory(env);

  function saveUsername(username) {
    clientConfig.set('username', username);
  }

  function revokeToken(token) {
    if(token && oauthConfig.revokeUrl) {
      return new Promise(function(resolve, reject) {
        var revokeUrl = oauthConfig.revokeUrl.replace('%token%', token);

        request.post(revokeUrl, (result) => {
          resolve();
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  function signin(idpConfig) {
    if(authWindow !== null) {
      //a oauth processs is already running
      authWindow.focus();
      var err = new Error('Login window already open');
      err.code = 'E_BLN_OAUTH_WINDOW_OPEN';
      return Promise.reject(err);
    }


    var urlParams = {
      scope: idpConfig.scope,
      client_id: idpConfig.clientId,
      response_type: idpConfig.responseType,
      redirect_uri: idpConfig.redirectUri
    };

    var url = idpConfig.authorizationUrl + '?' + queryString.stringify(urlParams);

    return new Promise(function (resolve, reject) {
      const ses = session.fromPartition('persist:oauth');
      var scheme = idpConfig.redirectUri.substr(0, idpConfig.redirectUri.length -3);
      
      function destroyWindow() {
        authWindow.removeAllListeners('closed');
        authWindow.destroy();
        windowStates.closed('oauth');
        ses.protocol.unregisterProtocol(scheme);
        authWindow = null;
      }

      function handleError(err) {
        logger.error('OAUTH: handleError', {err});

        destroyWindow();
        reject(err);
      }

      ses.protocol.registerFileProtocol(scheme, (request, callback) => {
        function getParamFromUrl(param, url) {
          var rawParam = new RegExp('[?#&]' + param + '=([^\&]+)\&?').exec(url);
          var value = (rawParam && rawParam.length > 1) ? rawParam[1] : null;

          return value;
        }

        var token = getParamFromUrl('access_token', request.url);
        var expires = getParamFromUrl('expires', request.url);
        
        if(token === null) {
          return handleError(new Error('No token set'));
        }

        if(expires === null) {
          return handleError(new Error('No expires set'));
        };

        clientConfig.set('auth', 'oidc');
        clientConfig.set('oidcProvider', idpConfig.provider);
        clientConfig.set('accessTokenExpires', expires);

        clientConfig.storeSecret('accessToken', token).then(() => {
          destroyWindow();
          resolve();
        });

        /*var sync = syncFactory(clientConfig.getAll(), logger);
        sync.blnApi.whoami(function(err, username) {
          if(err) {
            logger.error('OAUTH: got error', {err});
            return handleError(err);
          }

          logger.info('OAUTH: got username', {username});
          saveUsername(username);

          destroyWindow();
          resolve({token, expires, username});
        });*/
      }, (err) => {
        if(err) handleError(err);
      });

      authWindow = new BrowserWindow({
        alwaysOnTop: false,
        autoHideMenuBar: true,
        nodeIntegration: false,
        'use-content-size': true,
        webPreferences: {
          partition: 'persist:oauth'
        },
        icon: __dirname+'/../../img/taskbar_black.png'
      });

      authWindow.loadURL(url);
      authWindow.show();
      windowStates.opened('oauth');

      authWindow.on('closed', () => {
        handleError(new Error('Window was closed by user'));
      });
    });
  }

  return {
    revokeToken,
    signin
  };
};
