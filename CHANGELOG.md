## 0.0.30
**Maintainer**: balloon-team <maint@gyselroth.com>\
**Date**: Thu September 28 13:30:20 CEST 2017

* UI: [CHANGE] migrated fonts to ubuntu-font package #14
* UI: [FIX] fixed tray icon for *nix systems #17
* UI: [FIX] switched from ico to png for windows systems which should fix #15
* UI: [FIX] fixed install update button in tray menu is gone #13


## 0.0.29
**Maintainer**: balloon-team <maint@gyselroth.com>\
**Date**: Thu September 28 11:19:20 CEST 2017

* CORE: [FEATURE] Add migration framework
* CORE: [FIX] Fix ino collisions on windows
* CORE: [FEATURE] Add Balloon dir shortcut in windows explorer left pane
* CORE: [FIX] fixed memory config for threads at first start
* CORE: [FEATURE] Implemented support for refreshToken revocation
* CORE: [FEATURE] Added new option revokeAuthenticatioRequired
* CORE: [CHANGE] Removed useless oidc option
* UI: [FIX] fixed de-CH locale


## 0.0.28
**Maintainer**: balloon-team <maint@gyselroth.com>\
**Date**: Wed September 6 15:15:29 WEST 2017

* CORE: [FIX] It is now possible to use localhost or an IP as bln url
* CORE: [FIX] Enable Copy&Paste on OSX
* CORE: [FEATURE] Update balloon-node-sync


## 0.0.27
**Maintainer**: balloon-team <maint@gyselroth.com>\
**Date**: Wed Augist 30 15:04:32 CEST 2017

* CORE: [FIX] Auto startup is now the default if builded with nothing set for enableAutoLaunch
* CORE: [FEATURE] Adds balloon folder icon on linux
* CORE: [FEATURE] Adds balloon bookmark on linux (.config/gtk-3.0/bookmarks, read by nautilus)
* CORE: [FEATURE] credentials store can now be configured either to keytar or config via env.auth.secretStorage
* CORE: [FIX] fixed initial config writes from multiple threads
* CORE: [FIX] fixed renew accessToken if refreshToken is available
* CORE: [FEATURE] added new variable {username} for env.balloonDir and env.configDir
* UI: [FIX] Update action is now visible again under menu/about
* UI: [FIX] Increased about window height
* DISTRIBUTION: [FEATURE] Builds for Mac OSX are now signed therefore autoupdate should for for it
