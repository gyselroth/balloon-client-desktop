REM @ECHO OFF

SET balloonAppliesTo=%1
SET balloonIcon=%2

reg add "HKEY_CURRENT_USER\Software\Classes\*\shell\balloon" /v Icon /t REG_SZ /d %balloonIcon% /f
reg add "HKEY_CURRENT_USER\Software\Classes\*\shell\balloon" /v AppliesTo /t REG_SZ /d %balloonAppliesTo% /f
reg add "HKEY_CURRENT_USER\Software\Classes\*\shell\balloon\command" /ve /t REG_SZ /d "cmd.exe /Q /C \"echo %%D ^> \\?\pipe\balloon-client\"" /f
reg add "HKEY_CURRENT_USER\Software\Classes\Directory\shell\balloon" /v Icon /t REG_SZ /d %balloonIcon% /f
reg add "HKEY_CURRENT_USER\Software\Classes\Directory\shell\balloon" /v AppliesTo /t REG_SZ /d %balloonAppliesTo% /f
reg add "HKEY_CURRENT_USER\Software\Classes\Directory\shell\balloon\command" /ve /t REG_SZ /d "cmd.exe /Q /C \"echo %%D ^> \\?\pipe\balloon-client\"" /f

EXIT