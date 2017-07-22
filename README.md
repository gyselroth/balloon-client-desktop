# Balloon Desktop Client

## Configuration
Add your configuration in `config/env_[CONTEXT].json`

The following configuraiton options are available


* `name` String (optional) - the name of the context. `production` or `development`. Default: `production`
* `blnUrl` String (optional) - the url under which your Balloon installation is running. If not set user will be prompted to enter URL on first start (eg: `https://example-balloon.io`)
* `apiPath` String (optional) - the path to the API Default: `'/api/v1/'`
* `configDirName` String (optional) - name of the directory where configuration is stored on the client. The directory is created in the users home. Default: `.balloon`
* `configFileName` String (optional) - name of the configuration file inside `configDirName`. Default: `config.json`
* `balloonDirName` String (optional) - default name of the directory where the synced files are saved. The directory is created in the users home. Default: `Balloon`
* `log` Object (optional) - logging configuration
  * `level` String (optional) - Maximum level that should be logged. Default: `info`. Available levels: `{error: 3, warning: 4, notice: 5, info: 6, debug: 7}`
  * `maxsize` Integer (optional) - max size of a single lg file. Default: `10000000`
  * `maxFiles` Integer (optional) - maximum number of log files. Default: `10`
* `sync`: Object (optional) - sync configuration
  * `interval` Integer (optional) - interval in which syncs run in production context. Default: `20`
  * `maxConcurentConnections` Integer (optional) - maximum simultaneous connections for file up- and downloads
* `commandLineSwitches` Object (optional) - electron commandline switches. Set (eg: `{"authServerWhitelist": "*.example-balloon.io"})
* `enableAutoLaunch` Boolean (optional) - if app should be launched on system startup. Default: false
* `oAuth2Config` Object (required) - oauth configuration
  * `clientId` String (required) - Your client Id
  * `authorizationUrl` String (required) - The url to your oauth server. (eg: `https://oauth.example-balloon.io/`)
  * `revokeUrl` String (required) - The url on which an access token can be revoked on logout. %token% will be replaced in url. (https://oauth.example-balloon.io/revoke?access_token=%token%)
* `updateCheckInterval` Integer (optional) - Interval in days the client should check for updates. A first check is always done on app start. Default: `7`

## Recommended setup for development

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
