!macro customInit
	IfFileExists "$INSTDIR\resources\resources\env.json" 0 +2
		Rename "$INSTDIR\resources\resources\env.json" "$TEMP\balloon.env.json"
!macroend

Function .onInstSuccess
	IfFileExists "$TEMP\balloon.env.json" 0 +2
		Rename "$TEMP\balloon.env.json" "$INSTDIR\resources\resources\env.json"
FunctionEnd

!macro customUnInstall
	${ifNot} ${isUpdated}
		# remove autostart entry
		DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Balloon"

		# remove favorite in explorer
		DeleteRegKey HKCU "Software\Classes\CLSID\{5410396b-e8fa-479c-af05-c0edf82fb954}"
		DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\Desktop\NameSpace\{5410396b-e8fa-479c-af05-c0edf82fb954}"
		DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\HideDesktopIcons\NewStartPanel" "{5410396b-e8fa-479c-af05-c0edf82fb954}"
	${endIf}
!macroend
