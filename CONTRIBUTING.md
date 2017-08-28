# Recommended setup for development

```
mkdir balloon
cd balloon

git clone git@github.com:gyselroth/balloon-node-sync.git
cd balloon-node-sync
npm install
npm link

cd ..

git clone git@github.com:gyselroth/balloon-client-desktop.git
cd balloon-client-desktop
npm install
npm link @gyselroth/balloon-node-sync
```

# Build

## Automation
All builds are triggered automatically with commits into master. Windows builds are handled by [Appvoyer](https://ci.appveyor.com/project/raffis/balloon-client-desktop) whereas OSX and Linux builds are handled by [Travis-ci](https://travis-ci.org/gyselroth/balloon-client-desktop).

## Manually
Of course you can also building manually besides our CI tools.

### Linux
**Requirements**
* nodejs LTS v6.x
* libsecret-1-dev

**Build only**\
`npm run build-linux`

**Build and draft release to github**\
`GH_TOKEN=xxx npm run release-linux`

### OSX
**Requirements**
* XCode

**Build only**\
`npm run build-osx`

**Build and draft release to github**\
`GH_TOKEN=xxx npm run release-osx`

### Windows
**Requirements**
* Microsoft Visual Studio 2015
* npm install -g windows-build-tools

If you do not want to sign your build you can also leave out CSC_LINK and CSC_LINK.

**Build only**\
`CSC_LINK=/path/to/p12/cert CSC_KEY_PASSWORD=p12_key_password npm run build-win`

**Build and draft release to github**\
`GH_TOKEN=xxx CSC_LINK=/path/to/p12/cert CSC_KEY_PASSWORD=p12_key_password npm run release-win`

## Release
npm run release-* automatically drafts releases to github if you export a github oauth2 access token (GH_TOKEN), otherwise you can get your builds under ./dist. 
See balloon desktop client [releases](https://github.com/gyselroth/balloon-client-desktop/releases).


# Configuration
Add your configuration in `config/env_[CONTEXT].json`

The following configuration options are available

* `name` String (optional) - the name of the context. `production` or `development`. Default: `production`
* `blnUrl` String (optional) - the url under which your Balloon installation is running. If not set user will be prompted to enter URL on first start (eg: `https://example-balloon.io`)
* `apiPath` String (optional) - the path to the API Default: `'/api/v1/'`
* `configDir` String (optional) - path to the directory where configuration is stored on the client. You can use {HOME} which gets replaced with the current home directory. Default: `{HOME}/.balloon`
* `configFileName` String (optional) - name of the configuration file inside `configDirName`. Default: `config.json`
* `balloonDir` String (optional) - default path to the directory where the synced files are saved. You can use {GOME} which gets replaced with the current home directory. Default: `{HOME}/Balloon`
* `log` Object (optional) - logging configuration
  * `level` String (optional) - Maximum level that should be logged. Default: `info`. Available levels: `{error: 3, warning: 4, notice: 5, info: 6, debug: 7}`
  * `maxsize` Integer (optional) - max size of a single lg file. Default: `10000000`
  * `maxFiles` Integer (optional) - maximum number of log files. Default: `10`
* `sync`: Object (optional) - sync configuration
  * `interval` Integer (optional) - interval in which syncs run in production context. Default: `20`
  * `maxConcurentConnections` Integer (optional) - maximum simultaneous connections for file up- and downloads
* `enableAutoLaunch` Boolean (optional) - if app should be launched on system startup. Default: true
* `update` Object (optional) - update configuration
  * `enable` Boolean (optional) - Enables automatic (and manual) updates - Default: `true`
  * `checkInterval` Integer (optional) - Interval in days the client should check for updates. A first check is always done on app start. Default: `7`
* `auth`: Object (optional) - authentication configuration
  * `basic` Boolean (optional) - Enabled basic authentication (username/password), be sure that your server has basic authentication enabled
  * `oidc` Array (optional) - Configure multiple OpenID-connect provider, be sure that your server also supports those oidc provider
    * `provider` String (required) Name of the OpenID-connect provider
    * `clientId` String (required) client id
    * `clientSecret` String (required) client secret
    * `providerUrl` String (required) URL to the discovery document
    * `redirectUri` String (required) Redirect uri to local http port (for example: http://127.0.0.1:13005)
    * `localPort` String (required) Local listener, must be the same port which has been used in redirectUri
    * `scope` String (required) OAUTH2 scopes (For example: openid profile)
    * `imgBase64` String (required) Base64 encoded Oidc sign-in button
