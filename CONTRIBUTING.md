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
