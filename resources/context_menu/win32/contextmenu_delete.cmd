REM @ECHO OFF

SET balloonName=%1

reg delete "HKEY_CLASSES_ROOT\Folder\shell\{%balloonName%}" /f

EXIT