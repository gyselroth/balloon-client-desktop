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

const OidcError = require('./oidc-error.js');

/* the Node.js based HTTP client. */
const requestor = new NodeRequestor();

module.exports = function (env, clientConfig) {
  var notifier;
  var authorizationHandler;
  var tokenHandler;
  var idpConfig;
  var configuration;

  function signin(idp) {
    return new Promise(function(resolve, reject) {
      _signin(idp)
        .then(result => resolve(result))
        .catch(err => {
          if(err.message &&
            (
              /ENOTFOUND|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|EHOSTDOWN|ESOCKETTIMEDOUT|ECONNRESET/.test(err.message)
              ||
              err.message === 'Error: socket hang up'
            )
          ) {
            err = new OidcError(err.message, 'E_BLN_OIDC_NETWORK');
          }

          reject(err);
        })
    });
  }

  function _signin(idp) {
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
              clientConfig.storeSecret('accessToken', response.accessToken)
                .then(() => {
                  clientConfig.set('accessTokenExpires', response.issuedAt + response.expiresIn);
                  resolve();
                })
                .catch(err => {
                  logger.error('Could not store accessToken', {catgory: 'openid-connect', err});
                  reject(err);
                });
            }).catch((error) => {
              logger.info('failed to retrieve accessToken, request new refreshToken', {category: 'openid-connect', error});

              makeAuthorizationRequest()
                .then(() => {
                  resolve(true);
                })
                .catch((error) => {
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
          makeAuthorizationRequest().then((respone) => {
            resolve(true);
          }).catch((error) => {
            logger.error('failed to retrieve refreshToken', {
              category: 'openid-connect',
              error: error
            });

            reject(error);
          });
        }
      }).catch(reject); //catch fetchServiceConfiguration
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
      })
      .catch(err => {
        logger.error('Could not fetch service configuration', {category: 'openid-connect', err});
        throw err;
      });
   }

  function makeAuthorizationRequest() {
    return new Promise(function(resolve, reject) {
      notifier.setAuthorizationListener((request, response, error) => {
        logger.info('Authorization request complete ', {
          category: 'openid-connect',
          request: request,
          response: response,
          error: error
        });

        let codeVerifier;
        if(request && request.internal && request.internal.code_verifier) {
          codeVerifier = request.internal.code_verifier;
        }

        if(response) {
          makeRefreshTokenRequest(configuration, response.code, codeVerifier)
            .then((result) => {
              clientConfig.set('authMethod', 'oidc');

              var promises = [];

              promises.push(clientConfig.storeSecret('accessToken', result.accessToken));

              if(result.refreshToken) {
                promises.push(clientConfig.storeSecret('refreshToken', result.refreshToken))
              }

              Promise.all(promises).then(() => {
                logger.debug('Stored tokens', {category: 'openid-connect'});

                clientConfig.set('oidcProvider', idpConfig.providerUrl);
                clientConfig.set('accessTokenExpires', result.issuedAt + result.expiresIn);

                resolve();
              }).catch((err) => { //catch Promise.all
                clientConfig.set('authMethod', undefined);
                logger.error('Could not store tokens', {category: 'openid-connect', err})
                reject(err);
              });
            }).catch(reject); //catch makeRefreshTokenRequest
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

  function makeRefreshTokenRequest(configuration, code, codeVerifier) {
    let extras = {'client_secret': idpConfig.clientSecret};

    if(codeVerifier) {
      extras['code_verifier'] = codeVerifier;
    }

    // use the code to make the token request.
    let request = new TokenRequest({
      client_id: idpConfig.clientId,
      redirect_uri: idpConfig.redirectUri,
      grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
      code: code,
      refresh_token: undefined,
      extras: extras
    });

    return tokenHandler.performTokenRequest(configuration, request)
      .then(response => {
        logger.info('retrieved oauth2 refresh token', {category: 'openid-connect'});
        return response;
      })
      .catch(err => {
        logger.error('refresh token request failed', {category: 'openid-connect', err});
        throw err;
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

    return tokenHandler.performTokenRequest(configuration, request)
      .then(response => {
        logger.info('retrieved oauth2 access token', {category: 'openid-connect'});
        return response;
      })
      .catch(err => {
        logger.error('access token request failed', {category: 'openid-connect', err});
        throw err;
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

    return tokenHandler.performRevokeTokenRequest(configuration, request)
      .then(response => {
        logger.info('revoked refreshToken', {category: 'openid-connect'});
        return response;
      })
      .catch(err => {
        logger.error('revoke token request failed', {category: 'openid-connect', err});
        throw err;
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
          makeRevokeTokenRequest(configuration, secret).then(resolve).catch(reject);
        }).catch((error) => {
          logger.error('can not revoke token, token can not be fetched from secret storage', {
            category: 'openid-connect',
            error: error
          });

          reject(error);
        });
      }).catch(reject); //catch fetchServiceConfiguration
    });
  }

  return {
    signin,
    revokeToken
  };
};
