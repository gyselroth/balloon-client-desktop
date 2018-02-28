## 0.0.43-beta.1

## 0.0.42
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon Feb 26 16:05:52 CET 2018

* CORE: [CHANGE] introduced global app state, moved updateAvailable and onLineState to global app state #26
* CORE: [CHANGE] introduced new global flag `allowPrerelease` if set to true auto updater will install pre releases. #55


## 0.0.41
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Jan 23 08:30:08 CET 2018

* CORE: [FIX] Fixes Uncaught SyntaxError: Invalid regular expression #87
* CORE: [FIX] All dependencies include now patched versions automatically (~) #70


## 0.0.40
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri December 22 12:01:01 CET 2017

* CORE: [FIX] set delta node limit to 100, partially fixed sync can end in endless loop ESOCKETTIMEDOUT #78
* CORE: [FIX] removed remotedelta log db, fixes `Error: \"toString()\" failed\n at Buffer.toString (buffer.js:503 #85
* CORE: [FIX] fixed sync error exception occurence in log file #60
* CORE: [FIX] Reschedule nodes with ENOENT #84
* CORE: [CHANGE] changed log format for log files #79
* UI: [FIX] starting app without internet connection and no instance shows the wizard with no error message or loader #73


## 0.0.39
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue December 19 16:01:01 CET 2017

* CORE: [FIX] resource path in env.js is wrong in built windows env #75


## 0.0.38
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue December 19 14:02:01 CET 2017

* CORE: [FIX] fixes unlink instance if sync returns 401 and a refreshToken is present #68
* CORE: [FIX] partially fixes app which quits with no reason (no secret set) #69
* PACKAGING: [FIX] fixed update on OS X #67


## 0.0.37
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon December 18 09:49:02 CET 2017

* PACKAGING: [CHANGE] copy env between nsis updates #64
* PACKAGING: [CHANGE] Linux and OSX implement now a system wide env config in /etc/balloon-desktop #64
* PACKAGING: [CHANGE] Migrated from dmg to pkg package for OSX #64
* PACKAGING: [CHANGE] added balloon bitmap and license to nsis installer #65


## 0.0.36
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu Dezember 14 15:48:02 CET 2017

* CORE: [FIX] update custom build does overwrite custom env config #62
* CORE: [FIX] caught error is logged wrongly (exception logging) #60
* CORE: [FIX] unlink instance not possible if logout failed #61
* CORE: [FIX] electron-traywindow-positioner includes different version of electron which cause the build size doubled #58
* PACKAGING: [FIX] add linux application category #63


## 0.0.35
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu Dezember 14 09:33:46 CET 2017

* CORE: [FIX] sync lib to 0.0.30 fixes conflicting local folders
* CORE: [FIX] sync 0.0.30 introduces a slighty different merge concept. Conflicting folders do now get renamed as "conflict" as well, instead of being merged


## 0.0.34
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed Dezember 06 08:50:23 CET 2017

* CORE: [FIX] fixed multi sync threads running #34
* CORE: [FIX] fixed regex bug in sync library and various network problems resolved, bumping sync lib to 0.0.29 #34
* CORE: [FIX] added http request timeout, configurable via requestTimeout, default 10s, #29
* CORE: [FIX] client now checks the api server in a 5s interval after a sync request resulted in a network error #39
* CORE: [FIX] client does not unlink instance anymore if started with no connection to the server #40
* UI: [FIX] startup/auth wizard now shows an error message correctly if server cannot be reached, added loader gifs #40


## 0.0.33
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu November 17 15:14:43 CET 2017

* PACKAGING: [FIX] bintray deployment in stable branch


## 0.0.32
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu November 16 11:14:43 CET 2017

* CORE: [FIX] fixed random start errors which lead to an unusable state #28
* CORE: [CHANGE] log messages do now contain a category and a thread id #27
* CORE: [FIX] fixed various log level errors #27
* CORE: [FIX] simplified startup config check
* CORE: [FIX] the default interval to check for an update is now 4 hours (instead of 7 days) #30
* CORE: [FIX] added migration script to set bookmark and folder icon (which have been replaced in 0.0.31)
* CORE: [CHANGE] changed sync interval to 5s
* UI: [CHANGE] balloon icon does now only spin if data is exchanged between server and client
* UI: [FIX] fixed de-CH typo on the startup screen
* PACKAGING: [FEATURE] Deb packages are now gpg-signed and available on bintray, please consult the wiki for more information on how to install via apt


## 0.0.31
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed October 25 11:08:33 CEST 2017

* UI: [CHANGE] New balloon (tray) logo for all operating systems
* UI: [CHANGE] New startup/about balloon teaser image
* UI: [CHANGE] Implemented new logo for window and folder icons
* CORE: [FIX] Reauthentication does not get triggered if last authentication failed with network error
* CORE: [FIX] Fix (static) third party version for all dependencies
* CORE: [FIX] Startup wizard now shows an offline message even if a server url has been configured within the env (before build) and if the client cannot reach the api server
* CORE: [FIX] Auth prompt does not open after the client closed a network connection before the offline event was triggered, the reauthentication prompt now only opens if the api returns 401.
* CORE: [FIX] Fixed unlink account and pause sync; unlink now halts the sync as well instead of being triggered by the ui
* CORE: [FIX] User now gets unlinked correctly if account is not authenticated
* CORE: [FIX] App tray starts correctly even if no connection to the api server can be established
* PACKAGING: [FEATURE] Deb packages get deployed to bintray (apt repository), unstable&stable


## 0.0.30
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu September 28 13:30:20 CEST 2017

* UI: [CHANGE] migrated fonts to ubuntu-font package #14
* UI: [FIX] fixed tray icon for *nix systems #17
* UI: [FIX] switched from ico to png for windows systems which should fix #15
* UI: [FIX] fixed install update button in tray menu is gone #13


## 0.0.29
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu September 28 11:19:20 CEST 2017

* CORE: [FEATURE] Add migration framework
* CORE: [FIX] Fix ino collisions on windows
* CORE: [FEATURE] Add balloon dir shortcut in windows explorer left pane
* CORE: [FIX] Fixed memory config for threads at first start
* CORE: [FEATURE] Implemented support for refreshToken revocation
* CORE: [FEATURE] Added new option revokeAuthenticatioRequired
* CORE: [CHANGE] Removed useless oidc option
* UI: [FIX] Fixed de-CH locale


## 0.0.28
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed September 6 15:15:29 WEST 2017

* CORE: [FIX] It is now possible to use localhost or an IP as bln url
* CORE: [FIX] Enable Copy&Paste on OSX
* CORE: [FEATURE] Update balloon-node-sync


## 0.0.27
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed August 30 15:04:32 CEST 2017

* CORE: [FIX] Auto startup is now the default if built with nothing set for enableAutoLaunch
* CORE: [FEATURE] Adds balloon folder icon on linux
* CORE: [FEATURE] Adds balloon bookmark on linux (.config/gtk-3.0/bookmarks, read by nautilus)
* CORE: [FEATURE] Credentials store can now be configured either to keytar or config via env.auth.secretStorage
* CORE: [FIX] Fixed initial config writes from multiple threads
* CORE: [FIX] Fixed renew accessToken if refreshToken is available
* CORE: [FEATURE] Added new variable {username} for env.balloonDir and env.configDir
* UI: [FIX] Update action is now visible again under menu/about
* UI: [FIX] Increased window height
* DISTRIBUTION: [FEATURE] Builds for Mac OSX are now signed and therefore autoupdate should now work
