const logger = require('../../lib/logger.js');
const {AuthorizationRequest} = require('@openid/appauth/built/authorization_request.js');
const {AuthorizationNotifier, AuthorizationRequestHandler, AuthorizationRequestResponse, BUILT_IN_PARAMETERS} = require('@openid/appauth/built/authorization_request_handler.js');
const {AuthorizationResponse} = require('@openid/appauth/built/authorization_response.js');
const {AuthorizationServiceConfiguration} = require('@openid/appauth/built/authorization_service_configuration.js');
const {NodeBasedHandler} = require('@openid/appauth/built/node_support/node_request_handler.js');
const {NodeRequestor} = require('@openid/appauth/built/node_support/node_requestor.js');
const {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, TokenRequest} = require('@openid/appauth/built/token_request.js');
const {BaseTokenRequestHandler, TokenRequestHandler} = require('@openid/appauth/built/token_request_handler.js');
const {TokenError, TokenResponse} = require('@openid/appauth/built/token_response.js');

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
      configuration = config;
      initIdp();
      var oidcAuth = clientConfig.get('oidcProvider');

      if(oidcAuth) {
        clientConfig.retrieveSecret('refreshToken').then((secret) => {
          logger.info('found refreshToken, trying to request new access token')
          makeAccessTokenRequest(configuration, secret).then((response) => {
            callback();
            //Promise.resolve();
          }).catch((error) => {
            logger.info('failed to retrieve refreshToken', error);
            makeAuthorizationRequest(config, callback);
          });
        })
      } else {
        makeAuthorizationRequest(config, callback)/*.then((respone) => {
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
    //return new Promise(function(resolve, reject) {
    notifier.setAuthorizationListener((request, response, error) => {
      //log('Authorization request complete ', request, response, error);
      if (response) {
        makeRefreshTokenRequest(configuration, response.code)
          .then((result) => {
            clientConfig.storeSecret('refreshToken', result.refreshToken).then(() => { 
              clientConfig.set('auth', 'oidc');
              clientConfig.set('oidcProvider', idpConfig.provider);
              makeAccessTokenRequest(configuration, result.refreshToken).then((access) => {
                clientConfig.storeSecret('accessToken', access.accessToken).then(() => {
                  clientConfig.set('accessTokenExpires', access.issuedAt + access.expiresIn);
                  callback(true);
                  //Promise.resolve();
                  return result;
                });
              });
            });
          });
      }
    });


    // create a request
    let request = new AuthorizationRequest(
        idpConfig.clientId, idpConfig.redirectUri, idpConfig.scope, AuthorizationRequest.RESPONSE_TYPE_CODE,
        undefined, /* state */
        {'prompt': 'consent', 'access_type': 'offline'});

    logger.info('making oauth2 authorization request', configuration, request);
    authorizationHandler.performAuthorizationRequest(configuration, request);
    //});
  }

  function makeRefreshTokenRequest(configuration, code) {
    // use the code to make the token request.
    let request = new TokenRequest(
        idpConfig.clientId, idpConfig.redirectUri, GRANT_TYPE_AUTHORIZATION_CODE, code, undefined, {'client_secret': idpConfig.clientSecret});

    return tokenHandler.performTokenRequest(configuration, request).then(response => {
      logger.info('retrieved oauth2 refresh token');
      return response;
    }).catch((error) => {
      logger.error('failed requesting refresh token', error);
      //TODO raffis - Doing something here
    });
  }

  function makeAccessTokenRequest(configuration, refreshToken) {
    let request = new TokenRequest(
        idpConfig.clientId, idpConfig.redirectUri, GRANT_TYPE_REFRESH_TOKEN, undefined, refreshToken, {'client_secret': idpConfig.clientSecret});

    return tokenHandler.performTokenRequest(configuration, request).then(response => {
      logger.info('retrieved oauth2 access token');
      return response;
    }).catch((error) => {
      logger.error('failed requesting access token', error);
      //TODO raffis - Doing something here
    });
  }
  
  return {
    signin
  };
};
