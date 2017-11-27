REM @ECHO OFF

SET balloonName=%1
SET balloonAppliesTo=%2
SET balloonCommand=%3
SET balloonIcon=%4

reg add "HKEY_CLASSES_ROOT\Folder\shell\{%balloonName%}" /v Icon /t REG_SZ /d %balloonIcon% /f
reg add "HKEY_CLASSES_ROOT\Folder\shell\{%balloonName%}" /v AppliesTo /t REG_SZ /d %balloonAppliesTo% /f
reg add "HKEY_CLASSES_ROOT\Folder\shell\{%balloonName%}\command" /ve /t REG_SZ /d %balloonCommand% /f

EXIT