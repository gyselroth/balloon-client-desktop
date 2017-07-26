/**
* This module was heavily inspired by https://github.com/jvitor83/electron-oauth2/blob/master/index.js
**/

/*const queryString = require('querystring');
const request = require('request');
const extend = require('util')._extend;
*/

const logger = require('../../lib/logger.js');
const {AuthorizationRequest} = require('../../../node_modules/@openid/appauth/built/authorization_request.js');
const {AuthorizationNotifier, AuthorizationRequestHandler, AuthorizationRequestResponse, BUILT_IN_PARAMETERS} = require('../../../node_modules/@openid/appauth/built/authorization_request_handler.js');
const {AuthorizationResponse} = require('../../../node_modules/@openid/appauth/built/authorization_response.js');
const {AuthorizationServiceConfiguration} = require('../../../node_modules/@openid/appauth/built/authorization_service_configuration.js');
const {NodeBasedHandler} = require('../../../node_modules/@openid/appauth/built/node_support/node_request_handler.js');
const {NodeRequestor} = require('../../../node_modules/@openid/appauth/built/node_support/node_requestor.js');
const {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, TokenRequest} = require('../../../node_modules/@openid/appauth/built/token_request.js');
const {BaseTokenRequestHandler, TokenRequestHandler} = require('../../../node_modules/@openid/appauth/built/token_request_handler.js');
const {TokenError, TokenResponse} = require('../../../node_modules/@openid/appauth/built/token_response.js');

/* the Node.js based HTTP client. */
const requestor = new NodeRequestor();

module.exports = function (env, clientConfig) {
  var notifier;
  var authorizationHandler;
  var tokenHandler;
  var idpConfig;
  var configuration;

  function signin(idp, callback) {
    idpConfig = idp;
    //return new Promise(function(resolve, reject) {

    fetchServiceConfiguration().then(config => {
      console.log(config);
      configuration = config;
      initIdp();
      var oidcAuth = clientConfig.get('oidcAuth');

      if(oidcAuth) {
        makeAccessTokenRequest(configuration, oidcAuth.refreshToken).then((response) => {
          callback();
          //Promise.resolve();
        });
      } else {
        makeAuthorizationRequest(config, callback)/*.then((respone) => {
          console.log("02", response);
          Promise.resolve();
        });*/
      }
    });

    //});
  }

  
  function initIdp() {
    notifier = new AuthorizationNotifier();
    authorizationHandler = new NodeBasedHandler(idpConfig.localPort);
    tokenHandler = new BaseTokenRequestHandler(requestor);
    // set notifier to deliver responses
    authorizationHandler.setAuthorizationNotifier(notifier);
    // set a listener to listen for authorization responses
    // make refresh and access token requests.
  }

  function fetchServiceConfiguration() {
    return AuthorizationServiceConfiguration.fetchFromIssuer(idpConfig.connectUrl, requestor)
        .then(response => {
          return response;
        });
   } 

  function makeAuthorizationRequest(AuthorizationServiceConfiguration, callback) {
    //initIdp();
    //return new Promise(function(resolve, reject) {

    notifier.setAuthorizationListener((request, response, error) => {
      //log('Authorization request complete ', request, response, error);
      if (response) {
        makeRefreshTokenRequest(configuration, response.code)
          .then(result => makeAccessTokenRequest(configuration, result.refreshToken))
          .then((result) => {
            clientConfig.set('auth', 'oidc');
            clientConfig.set('oidcAuth', {
              'provider': idpConfig.provider,
              'refreshToken': result.refreshToken,
              'accessToken': result.accessToken,
              'accessTokenExpires': result.issuedAt + result.expiresIn,
            });
            
            callback(true);
            //Promise.resolve();
            return result;
          });
      }
    });


    // create a request
    let request = new AuthorizationRequest(
        idpConfig.clientId, idpConfig.redirectUri, idpConfig.scope, AuthorizationRequest.RESPONSE_TYPE_CODE,
        undefined, /* state */
        {'prompt': 'consent', 'access_type': 'offline'});

    //log('Making authorization request ', configuration, request);
    authorizationHandler.performAuthorizationRequest(configuration, request);
  
    //});
  }

  function makeRefreshTokenRequest(configuration, code) {
    // use the code to make the token request.
    let request = new TokenRequest(
        idpConfig.clientId, idpConfig.redirectUri, GRANT_TYPE_AUTHORIZATION_CODE, code, undefined, {'client_secret': idpConfig.clientSecret});

    return tokenHandler.performTokenRequest(configuration, request).then(response => {
      //log(`Refresh Token is ${response.refreshToken}`);
      return response;
    }).catch((error) => {
      //TODO raffis - Doing something here
    });
  }

  function makeAccessTokenRequest(configuration, refreshToken) {
    let request = new TokenRequest(
        idpConfig.clientId, idpConfig.redirectUri, GRANT_TYPE_REFRESH_TOKEN, undefined, refreshToken, {'client_secret': idpConfig.clientSecret});

    return tokenHandler.performTokenRequest(configuration, request).then(response => {
      console.log(response);
      //log(`Access Token is ${response.accessToken}`);
      return response;
    }).catch((error) => {
      //TODO raffis - Doing something here
    });
  }
  
  return {
    signin
  };
};
