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
