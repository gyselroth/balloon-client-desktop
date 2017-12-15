!macro customInit
	IfFileExists "$INSTDIR\resources\resources\env.json" 0 +2
		Rename "$INSTDIR\resources\resources\env.json" "$TEMP\balloon.env.json"
!macroend

Function .onInstSuccess
	IfFileExists "$TEMP\balloon.env.json" 0 +2
		Rename "$TEMP\balloon.env.json" "$INSTDIR\resources\resources\env.json" 	
FunctionEnd