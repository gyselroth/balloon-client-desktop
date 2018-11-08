const logger = require('../logger.js');
const {AuthorizationRequest} = require('@openid/appauth/built/authorization_request.js');
const {AuthorizationNotifier, AuthorizationRequestHandler, AuthorizationRequestResponse, BUILT_IN_PARAMETERS} = require('@openid/appauth/built/authorization_request_handler.js');
const {AuthorizationResponse} = require('@openid/appauth/built/authorization_response.js');
const {AuthorizationServiceConfiguration} = require('@openid/appauth/built/authorization_service_configuration.js');
const {NodeBasedHandler} = require('@openid/appauth/built/node_support/node_request_handler.js');
const {NodeRequestor, NodeCrypto} = require('@openid/appauth/built/node_support/index.js');

const {GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, TokenRequest} = require('@openid/appauth/built/token_request.js');
const {RevokeTokenRequest} = require('@openid/appauth/built/revoke_token_request.js');
const {BaseTokenRequestHandler, TokenRequestHandler} = require('@openid/appauth/built/token_request_handler.js');
const {TokenError, TokenResponse} = require('@openid/appauth/built/token_response.js');
const {URL} = require('url');

/* the Node.js based HTTP client. */
const requestor = new NodeRequestor();

module.exports = function (env, clientConfig) {
  var notifier;
  var authorizationHandler;
  var tokenHandler;
  var idpConfig;
  var configuration;

  function signin(idp) {
    idpConfig = idp;
    return new Promise(function(resolve, reject) {
      fetchServiceConfiguration().then(config => {
        configuration = config;
        initIdp();
        var oidcAuth = clientConfig.get('oidcProvider');

        if(oidcAuth) {
          clientConfig.retrieveSecret('refreshToken').then((secret) => {
            logger.info('found refreshToken, trying to request new access token', {
              category: 'openid-connect'
            });

            makeAccessTokenRequest(configuration, secret).then((response) => {
              clientConfig.storeSecret('accessToken', response.accessToken).then(() => {
                clientConfig.set('accessTokenExpires', response.issuedAt + response.expiresIn);
                resolve();
              }).catch((error) => {
                reject(error)
              });
            }).catch((error) => {
              logger.info('failed to retrieve accessToken, request new refreshToken', {
                category: 'openid-connect',
                error: error
              });

              makeAuthorizationRequest(config).then((error) => {
                resolve(true);
              }).catch((error) => {
                logger.error('failed to retrieve refreshToken', {
                  category: 'openid-connect',
                  error: error
                });

                reject(error);
              });
            });
          }).catch((error) => {
            logger.error('failed to read refreshToken from secret store', {
              category: 'openid-connect',
              error: error
            });

            reject(error);
          });
        } else {
          makeAuthorizationRequest(config).then((respone) => {
            resolve(true);
          }).catch((error) => {
            logger.error('failed to retrieve refreshToken', {
              category: 'openid-connect',
              error: error
            });

            reject(error);
          });
        }
      });
    });
  }

  function getLocalPort(url) {
    var localUrl = new URL(url);
    return localUrl.port;
  }

  function initIdp() {
    notifier = new AuthorizationNotifier();
    authorizationHandler = new NodeBasedHandler(getLocalPort(idpConfig.redirectUri));
    tokenHandler = new BaseTokenRequestHandler(requestor);
    // set notifier to deliver responses
    authorizationHandler.setAuthorizationNotifier(notifier);
    // set a listener to listen for authorization responses
    // make refresh and access token requests.
  }

  function fetchServiceConfiguration() {
    return AuthorizationServiceConfiguration.fetchFromIssuer(idpConfig.providerUrl, requestor)
      .then(response => {
        return response;
      });
   }

  function makeAuthorizationRequest(AuthorizationServiceConfiguration) {
    return new Promise(function(resolve, reject) {
      notifier.setAuthorizationListener((request, response, error) => {
        logger.info('Authorization request complete ', {
          category: 'openid-connect',
          request: request,
          response: response,
          error: error
        });

        if (response) {
          makeRefreshTokenRequest(configuration, response.code)
            .then((result) => {
              clientConfig.storeSecret('refreshToken', result.refreshToken).then(() => {
                clientConfig.set('authMethod', 'oidc');
                clientConfig.set('oidcProvider', idpConfig.providerUrl);
                makeAccessTokenRequest(configuration, result.refreshToken).then((access) => {
                  clientConfig.storeSecret('accessToken', access.accessToken).then(() => {
                    clientConfig.set('accessTokenExpires', access.issuedAt + access.expiresIn);
                    resolve();
                  }).catch((error) => {
                    reject(error)
                  });
                });
              }).catch((error) =>{
                reject(error)
              });
            });
        } else {
          reject(error);
        }
      });

      // create a request
      let request = new AuthorizationRequest({
        client_id: idpConfig.clientId,
        redirect_uri: idpConfig.redirectUri,
        scope: idpConfig.scope,
        response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
        state: undefined,
        extras: {'prompt': 'consent', 'access_type': 'offline'}
      }, new NodeCrypto());

      logger.info('oauth2 authorization request', {
        category: 'openid-connect',
        config: configuration,
        request: request
      });

      authorizationHandler.performAuthorizationRequest(configuration, request);
   });
  }

  function makeRefreshTokenRequest(configuration, code) {
    // use the code to make the token request.
    let request = new TokenRequest({
      client_id: idpConfig.clientId,
      redirect_uri: idpConfig.redirectUri,
      grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
      code: code,
      refresh_token: undefined,
      extras: {'client_secret': idpConfig.clientSecret}
    });

    return tokenHandler.performTokenRequest(configuration, request).then(response => {
      logger.info('retrieved oauth2 refresh token', {category: 'openid-connect'});
      return response;
    });
  }

  function makeAccessTokenRequest(configuration, refreshToken) {
    let request = new TokenRequest({
      client_id: idpConfig.clientId,
      redirect_uri: idpConfig.redirectUri,
      grant_type: GRANT_TYPE_REFRESH_TOKEN,
      code: undefined,
      refresh_token: refreshToken,
      extras: {'client_secret': idpConfig.clientSecret}
    });

    return tokenHandler.performTokenRequest(configuration, request).then(response => {
      logger.info('retrieved oauth2 access token', {category: 'openid-connect'});
      return response;
    });
  }

  function makeRevokeTokenRequest(configuration, refreshToken) {
    let options = {
      token: refreshToken,
      tokenTypeHint: 'refresh_token',
    };

    if(idpConfig.revokeAuthenticationRequired !== false) {
      options.client_id = idpConfig.clientId;
      options.client_secret = idpConfig.clientSecret;
    }

    let request = new RevokeTokenRequest(options);

    return tokenHandler.performRevokeTokenRequest(configuration, request).then(response => {
      logger.info('revoked refreshToken', {category: 'openid-connect'});
      return response;
    });
  }

  function revokeToken(idp) {
    idpConfig = idp;
    return new Promise(function(resolve, reject) {
      fetchServiceConfiguration().then(config => {
        configuration = config;
        initIdp();
        clientConfig.retrieveSecret('refreshToken').then((secret) => {
          logger.debug('found refreshToken to revoke', {category: 'openid-connect'})
          makeRevokeTokenRequest(configuration, secret).then((response) => {
            resolve();
          }).catch((error) => {
            logger.info('failed to revoke refreshToken', {
              category: 'openid-connect',
              error: error
            });

            reject(error);
          });
        }).catch((error) => {
          logger.error('can not revoke token, token can not be fetched from secret storage', {
            category: 'openid-connect',
            error: error
          });

          reject(error);
        });
      });
    });
  }

  return {
    signin,
    revokeToken
  };
};
