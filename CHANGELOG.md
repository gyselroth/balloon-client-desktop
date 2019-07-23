## 1.1.1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Jul 23 13:14:33 CEST 2019

* CORE [FIX] oidc access token can't be refreshed #200


## 1.1.0
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed Jun 12 10:32:21 CEST 2019

no changes


## 1.1.0-beta2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue May 28 15:49:23 CEST 2019

* CORE: [FIX] Failed to connect with server #189
* UI: [FEATURE] Click on a file in tray activities should open parent folder in os file browser #182


## 1.1.0-beta1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed May 22 15:17:23 CEST 2019

* CORE: [FEATURE] Implement token flow and MFA #186
* CORE: [CHANGE] Add os/version to useragent #187


## 1.0.0
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu February 07 09:36:23 CET 2019

* CORE: [FIX] Increased tray performance during initial sync #178
* CORE: [CHANGE] Display new tray state while directory structure is synchronized
* CORE: [FIX] Missing client version in user-agent #183
* UI: [FIX] Disable horinzontal scrollbar in tray error page #181


## 1.0.0-rc2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu February 07 09:36:23 CET 2019

* CORE: [FIX] Open selective halts sync #174
* CORE: [FIX] Avoid concurrent refreshAccessToken requests #176
* CORE: [FIX] Avoid creating login item for app translocation paths #177
* CORE: [FIX] Corrupt Feedback #175
* CORE: [FIX] Unbind lsiteners before binding them again #178


## 1.0.0-rc1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri December 21 16:27:35 CET 2018

* UI: [FIX] Small user interface fixes
* UI: [FIX] balloon path cut off #170
* CORE: [FIX] Restart full sync after sync received 401 and refreshed acess token


## 1.0.0-beta4
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri December 21 10:29:35 CET 2018

* UI: [FIX] Small user interface fixes
* UI: [FIX] Tray sync continue not updated back to sync pause after click #166
* UI: [FIX] balloon folder not changed in ui after selecting a new one during startup wizard #167
* SYNC: [CHANGE] Upgrade sync to v0.3.0-beta2


## 1.0.0-beta3
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu December 20 14:29:34 CET 2018

* CORE: [FIX] Upgrade from 0.2.4 to 1.0.0-beta1 unlinked active instance #160
* CORE: [FIX] TypeError: this.app.whenReady is exception #158
* CORE: [FIX] Instances not in feedbacks metadata #157
* CORE: [FIX] Ignore shares by default, open selective before sync added new share to ignore db #162
* UI: [FIX] Used Storage Percentage #159
* UI: [FIX] Fixed de-CH and en-US translations
* SYNC: [CHANGE] Upgrade sync to v0.3.0-beta1


## 1.0.0-beta2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri December 14 14:35:32 CET 2018

* UI: [FIX] fixed crash tray with de locale


## 1.0.0-beta1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri December 14 13:49:32 CET 2018

* CORE: [CHANGE] Upgrade various dependencies, remove obsolete dependencies
* CORE: [CHANGE] Upgrade @openid/appauth to v1.1.1 #143
* CORE: [FIX] Catch errors on oidc sing in and revoke #137
* CORE: [FIX] Enable copy&paste in feedback and login fields #113
* CORE: [CHANGE] Add context menu for feedback and basic auth login #101
* CORE: [CHANGE] Store temporary feedback in sessionStorage #111
* CORE: [FIX] Hide loader after feedback send error #77
* CORE: [CHANGE] Add env to instance #24
* CORE: [CHANGE] Support unlimited quota #109
* CORE: [FIX] reset instance after server changed #145
* CORE: [FEATURE] display transfer status in tray #103
* CORE: [FEATURE] Allow to change location of BalloonDir #46
* CORE: [CHANGE] Handle 401 on getQuotaUsage requests #125
* CORE: [CHANGE] If a last known server is available put it into the server field for auth (if instance was unlinked before) #149
* CORE: [CHANGE] Replace fsinfo with output from systeminformation package #146
* CORE: [FIX] Ask admin privileges for fsutil calls on windows #135
* CORE: [FEATURE] Add balloon folder bookmark (favourites) on Mac OS X #31
* CORE: [FIX] Use fileicon for osx diricon instead shipping by ourselfs #147
* CORE: [FIX] Improve condition for api ping #1
* CORE: [CHANGE] Only reset cursor and db when triggered by remote delta #152
* SYNC: [CHANGE] Using @gyselroth/balloon-node-sync v0.3.0 including various sync fixes
* UI: [FIX] Desktop ui freezes during initial sync on Ubuntu 18.04 #133
* UI: [CHANGE] Display share/reference icon in selected sync tree #153
* UI: [FIX] Two tray icon on linux mint 19 Tara #115
* UI: [FEATURE] Implement prompt to confirm update #25


## 0.2.4
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri November 02 12:25:33 CET 2018

* CORE: [CHANGE] Upgrade sync to v0.2.5, fixes various sync issues
* CORE: [FIX] Connect new user ends in stuck sync #118
* CORE: [FIX] Connect a user which was previously connected can result in data loss #121
* CORE: [FIX] Catch `Service shut down unexpectedly` #123
* CORE: [FIX] Handle E_BLN_DELTA_FAILED #124
* CORE: [CHANGE] Improve logging for tray window
* CORE: [CHANGE] Remove clientSecret from feedback reports #129
* CORE: [FIX] Handle 401 thrown by selective window #127
* CORE: [FIX] Handle 401 thrown by remote watcher #126
* CORE: [FIX] Handle 401 thrown by watcher start #130
* CORE: [Change] Start sync after access token is refreshed #131
* CORE: [FIX] Catch oidc.signin errors

## 0.2.3
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Sept 21 08:40:33 CEST 2018

* CORE: [FIX] Upgrade sync to v0.2.3, partially fixes sync can result in DDOS #119


## 0.2.2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed Aug 29 13:43:40 CEST 2018

* CORE: [FIX] Feedback occasionally sends corrupt zip #107
* CORE: [FIX] network connectivity incorrect, race condition online:false => online:true #108


## 0.2.1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon Jul 02 08:50:44 CEST 2018

* UI: [FIX] Fixes feedback zip on Windows #105 and #106
* CORE: [CHANGE] Extended online state logging for #108, upgraded node-sync to v0.2.2


## 0.2.0
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon Jun 18 11:49:21 CEST 2018

* CORE: [CHANGE] Upgrade sync to v0.2.1


## 0.2.0-alpha1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed May 09 14:46:23 CEST 2018

* CORE: [FEATURE] Only run sync if kernel notifies changes (watchdog) or delta got changes #102
* CORE: [CHANGE] Include rotated log files in feedback #35
* CORE: [FEATURE] new setting autoReport, if enabled log files will be sent in recuring periods #96
* CORE: [FIX] file gets added as new instead moved #100
* CORE: [CHANGE] upgraded to electron v2.0.0
* CORE: [FEATURE] Accept self signed ssl certificates via config `tlsVerifyCert` #91


## 0.1.1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue May 15 14:52:11 CEST 2018

* CORE: [FIX] Various sync fixes with balloon-node-sync v0.1.1


## 0.1.0
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu Apr 19 15:41:32 CEST 2018

* CORE: [FIX] Show notice in selective settings dialog, if no colections on root level exist #97
* CORE: [FIX] Do not show tab "current user" in settings dialog if no user is logged in #98


## 0.1.0-beta4
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Apr 06 17:22:02 CEST 2018

* CORE: [FIX] fixes balloon-node-sync dependency


## 0.1.0-beta3
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Apr 06 14:22:02 CEST 2018

* CORE: [CHANGE] Use new ballon-node-sync api
* CORE: [FIX] Do not query quota, when no user is logged in
* CORE: [FIX] Do not start sync, when no user is logged in
* CORE: [FIX] Wait until sync stopped before logout in unlinkAccount


## 0.1.0-beta2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon Apr 03 10:44:43 CEST 2018

* UI: [CHANGE] ui design improvements #95
* CORE: [FIX] fixes invalid selective sync in certain cases #45


## 0.1.0-beta1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Mar 16 15:23:28 CET 2018

* CORE: [FEATURE] Allow to change selective sync after initialization #45
* CORE: [FEATURE] It is now possible to selctive sync child nodes #90
* CORE: [CHANGE] Allow children to be ignored/unignored in selective sync #93
* CORE: [CHANGE] introduced settings dialog #56
* UI: [CHANGE] Feedback/settings/about is now integrated in the tray windows, various ui fixes #95
* UI: [FIX] Selective sync tree is now sorted #94
* UI: [CHANGE] Switched to gyselroth/icon-collection #16


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
