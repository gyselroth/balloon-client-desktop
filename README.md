# Balloon Desktop Client
[![Build status](https://ci.appveyor.com/api/projects/status/ym07006bvsrjo698?svg=true)](https://ci.appveyor.com/project/raffis/balloon-client-desktop)
[![Build status](https://api.travis-ci.org/gyselroth/balloon-client-desktop.svg?branch=master
)](https://api.travis-ci.org/gyselroth/balloon-client-desktop)

This is the desktop client for the [balloon](https://github.com/gyselroth/balloon) cloud server.

## Download

See [Releases](https://github.com/gyselroth/balloon-client-desktop/releases) to download your Windows/Mac OS X/Linux balloon desktop client.

## Documentation

See [Wiki](https://github.com/gyselroth/balloon-client-desktop/wiki) for more information.

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
