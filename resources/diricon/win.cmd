@ECHO OFF
PUSHD "%~dp0"

SET balloonDir=%1
SET iconFile=%2

CD "%balloonDir%"
ATTRIB -R "%balloonDir%"
ATTRIB -H -R "%iconFile%"
ATTRIB -H -R desktop.ini
DEL desktop.ini
ECHO [.ShellClassInfo] >> desktop.ini
ECHO ConfirmFileOp=0 >> desktop.ini
ECHO NoSharing=1 >> desktop.ini
ECHO IconFile=%iconFile% >> desktop.ini
ECHO IconIndex=0 >> desktop.ini
ATTRIB +H +S "%iconFile%"
ATTRIB +H +S desktop.ini
ATTRIB +S "%balloonDir%"
POPD
EXIT
