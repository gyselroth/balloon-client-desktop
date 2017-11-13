# Contribute to balloon desktop client
Did you find a bug or would you like to contribute a feature? You are more than welcome to do so.
Please, always file an [issue](https://github.com/gyselroth/balloon-client-desktop/issues/new) first to discuss the matter at hand. Please, refrain from developing without an open issue; otherwise we do not know what you are working on. 

## Bug
If you just want to file a bug report, please open your [issue](https://github.com/gyselroth/balloon-client-desktop/issues/new).
We are always eager to fix your reported bug to provide best software for the opensource community.

## Security flaw
Do not open an issue for a possible security vulnerability, to protect yourself and others please contact <opensource@gyselroth.net>
to report your concern.

## Git
You can clone the repository from:
```
git clone https://github.com/gyselroth/balloon-client-desktop.git
```

## Git commit 
Please make sure that you always specify the number of your issue starting with a hastag (#) within any git commits.

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
You are absolutely welcome to submit a pull request which references an open issue. Please make sure you're follwing coding standards 
and be sure all your modifications pass the build.
[![Build Status](https://travis-ci.org/gyselroth/balloon-client-desktop.svg)](https://travis-ci.org/gyselroth/balloon-client-desktop)

## Code of Conduct
Please note that this project is released with a [Contributor Code of Conduct](https://github.com/gyselroth/balloon-client-desktop/CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## License
This software is freely available under the terms of [GPL-3.0](https://github.com/gyselroth/balloon-client-desktop/LICENSE), please respect this license
and do not contribute software which ist not compatible with GPL-3.0 or is not your work.

## Editor config
This repository gets shipped with an .editorconfig configuration. For more information on how to configure your editor please visit [editorconfig](https://github.com/editorconfig).

## Code policy
There are no javascript standards like PSR-1/2 for PHP, but please follow the following rules:

* Abstract classes named with an Abstract prefix: AbstractExample
* Interfaces named with an Interface suffix: ExampleInterface
* Variables named with underscore (_) and not camelCase
* Methods and classes follow the camelCase naming
* All files delcare "use strict;"
* Always cache dom objects which will be used more than once: (`var $body = $('body');`)
* Add a $ prefix for variables containing a jquery object
* Always use i18next for output messages
* All api calls must use balloon.xmlHttpRequest()

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
* `configDir` String (optional) - path to the directory where configuration is stored on the client. You can use {home}/{username} which gets replaced with the current home directory/local username. Default: `{home}/.balloon`
* `configFileName` String (optional) - name of the configuration file inside `configDirName`. Default: `config.json`
* `balloonDir` String (optional) - default path to the directory where the synced files are saved. You can use {home}/{username} which gets replaced with the current home directory/local username. Default: `{home}/Balloon`
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
  * `secretStorage` String (optional) - Credential storage, Either config or keytar (OS keychain). Default: `keytar`
  * `basic` Boolean (optional) - Enabled basic authentication (username/password), be sure that your server has basic authentication enabled
  * `oidc` Array (optional) - Configure multiple OpenID-connect provider, be sure that your server also supports those oidc provider
    * `clientId` String (required) client id
    * `clientSecret` String (required) client secret
    * `providerUrl` String (required) URL to the discovery document
    * `redirectUri` String (required) Redirect uri to local http port (for example: http://127.0.0.1:13005)
    * `revokeAuthenticationRequired` Boolean (otional) Should be false if the /revoke endpoint does not require client authentication. Default: `true`
    * `scope` String (required) OAUTH2 scopes (For example: openid profile)
    * `imgBase64` String (required) Base64 encoded Oidc sign-in button
