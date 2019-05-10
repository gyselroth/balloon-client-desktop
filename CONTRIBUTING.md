# Contribute to balloon desktop client
Did you find a bug or would you like to contribute a feature? You are more than welcome to do so.
Please, always file an [issue](https://github.com/gyselroth/balloon-client-desktop/issues/new) first in order to discuss the matter at hand. Please, refrain from developing without an open issue; otherwise we will not know what you are working on. 

## Bug
If you just want to file a bug report, please open your [issue](https://github.com/gyselroth/balloon-client-desktop/issues/new).
We are always eager to fix your reported bug to provide best software for the opensource community.

## Security flaw
Do not open an issue for a possible security vulnerability; in order to protect yourself and others, please always contact <opensource@gyselroth.net>
to report your concerns.

## Git
You can clone the repository from:
```
git clone https://github.com/gyselroth/balloon-client-desktop.git
```

## Git commit 
Please make sure that (within a git commit) you always specify the number of your issue starting with a hashtag (#).

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

## Pull Request
You are more than welcome to submit a pull request that references an open issue. Please make sure that you observe coding conventions 
and also ensure that all your modifications pass the build.
[![Build Status](https://travis-ci.org/gyselroth/balloon-client-desktop.svg)](https://travis-ci.org/gyselroth/balloon-client-desktop)

## Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](https://github.com/gyselroth/balloon-client-desktop/CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## License
This software is freely available under the terms of [GPL-3.0](https://github.com/gyselroth/balloon-client-desktop/LICENSE), please respect this license and do not contribute software which ist not compatible with GPL-3.0 or is not your work.

## Editor config
This repository gets shipped with an .editorconfig configuration. For more information on how to configure your editor, please visit [editorconfig](https://github.com/editorconfig).

# Build

## Automation
All builds are triggered automatically with commits into master. Windows builds are handled by [Appvoyer](https://ci.appveyor.com/project/raffis/balloon-client-desktop) whereas OSX and Linux builds are handled by [Travis-ci](https://travis-ci.org/gyselroth/balloon-client-desktop).

## Manually

You need to build the client seperately on each OS. You need the latest [npm](https://nodejs.org/en/) version on each of them.

### Linux
**Requirements**
* libsecret-1-dev

**Build only**\
`npm run build-linux`

**Build and draft release to github**\
`GH_TOKEN=xxx npm run release-linux`

### OSX
**Requirements**
* XCode

**Build only**\
`CSC_LINK=/path/to/apple_dev/cert CSC_KEY_PASSWORD=apple_key_password npm run build-osx`

**Build and draft release to github**\
`GH_TOKEN=xxx CSC_LINK=/path/to/apple_dev/cert CSC_KEY_PASSWORD=apple_key_password npm run release-osx`

If you do not want to sign your build, you can also leave out CSC_LINK and CSC_KEY_PASSWORD.

### Windows
**Requirements**
* Microsoft Visual Studio 2015 or [Visual c++ build tools 2015](http://landinghub.visualstudio.com/visual-cpp-build-tools)
* npm install -g windows-build-tools

**Hint**: Disable any antivirus scanner and Windows Defender if you encounter any error regarding certificate is locked or used by another programm.


If you do not want to sign your build, you can also leave out CSC_LINK and CSC_KEY_PASSWORD.

**Build only**\
`CSC_LINK=/path/to/p12/cert CSC_KEY_PASSWORD=p12_key_password npm run build-win`

**Build and draft release to github**\
`GH_TOKEN=xxx CSC_LINK=/path/to/p12/cert CSC_KEY_PASSWORD=p12_key_password npm run release-win`

## Release
npm run release-* automatically drafts releases to github if you export a github oauth2 access token (GH_TOKEN), otherwise you can get your builds from ./dist. 
See balloon desktop client [releases](https://github.com/gyselroth/balloon-client-desktop/releases).


# Custom configuration
Add your configuration in `config/env_[CONTEXT].json` (usuallly config/env_production.json)

The following configuration options are available:

* `name` String (optional) - the name of the context. `production` or `development`. Default: `production`
* `version` Integer (optional) - version of this configuration (Increase if you want to update env configuration between build updates). Default: `0`
* `tlsVerifyCert` Boolean (optional) - Accept self signed SSl certificates. Default: `true` on development, `false` on production
* `blnUrl` String (optional) - the url under which your Balloon installation is running. If no set user is prompted to enter URL on first start (eg: `https://example-balloon.io`)
* `apiPath` String (optional) - the path to the API Default: `'/api/v1/'`
* `configDir` String (optional) - path to the directory where configuration is stored on the client. You can use {home}/{username} which gets replaced with the current home directory/local username. This setting only works well if update.enable is set on `false`. Default: `{home}/.balloon`
* `configFileName` String (optional) - name of the configuration file inside `configDirName`. Default: `config.json`
* `balloonDir` String (optional) - default path to the directory where the synced files are saved. You can use {home}/{username} which gets replaced with the current home directory/local username. Default: `{home}/Balloon`
* `log` Object (optional) - logging configuration
  * `level` String (optional) - maximum level that should be logged. Default: `debug`. Available levels: `{error: 3, warning: 4, notice: 5, info: 6, debug: 7}`
  * `maxsize` Integer (optional) - maximum size of a single lg file. Default: `10000000`
  * `maxFiles` Integer (optional) - maximum number of log files. Default: `10`
* `requestTimeout` Integer (optional) - api request timeout in miliseconds. Default: `30000`
* `sync`: Object (optional) - sync configuration
  * `interval` Integer (optional) - interval in which syncs run in production context. Default: `5`
  * `maxConcurentConnections` Integer (optional) - maximum simultaneous connections for file up- and downloads
* `enableAutoLaunch` Boolean (optional) - if app should be launched on system startup. Default: true
* `allowPrerelease` Boolean (optional) - if auto updater should install pre releases. Default: false
* `update` Object (optional) - update configuration
  * `enable` Boolean (optional) - enables automatic (and manual) updates - Default: `true`
  * `checkInterval` Integer (optional) - interval in hours the client should check for updates. A first check is always done on app start. Default: `4`
* `winClsId` String (optional) - Windows explorer ClsId
* `auth`: Object (optional) - authentication configuration
  * `secretStorage` String (optional) - credential storage, either config or keytar (OS keychain). Default: `keytar`
  * `credentials` null|'basic'|'token' - if `null` only oidc auth is active, `token` for internal token flow, `basic` for basic authentication. Be sure your server supports the configured authentication method. Default: `token`
  * `oidc` Array (optional) - configure multiple OpenID-connect provider, be sure that your server also supports those oidc provider
    * `clientId` String (required) client id
    * `clientSecret` String (required) client secret
    * `providerUrl` String (required) URL to the discovery document
    * `redirectUri` String (required) redirect uri to local http port (for example: http://127.0.0.1:13005)
    * `revokeAuthenticationRequired` Boolean (otional) should be false if the /revoke endpoint does not require client authentication. Default: `true`
    * `scope` String (required) OAUTH2 scopes (For example: openid profile)
    * `imgBase64` String (required) base64 encoded Oidc sign-in button
* `autoReport` Boolean (optional) - If true report will be sent every `autoReportInterval` to `autoReportPutUrl` Default: `false`
* `autoReportPutUrl` String (optional) - Url to which to send auto reports
* `autoReportInterval` Integer (optional) - Interval to send auto reports in milliseconds. Default: `300000`
