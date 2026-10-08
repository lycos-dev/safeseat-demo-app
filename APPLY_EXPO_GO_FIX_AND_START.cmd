@echo off
setlocal
cd /d "%~dp0"

echo.
echo SafeSeat - Expo Go connection fix
echo =================================
echo This removes expo-dev-client so Expo starts in Expo Go mode by default.
echo It also ensures expo-location is installed for the Emergency GPS workflow.
echo.

call npm uninstall expo-dev-client
if errorlevel 1 goto :fail

call npx expo install expo-location
if errorlevel 1 goto :fail

echo.
echo Starting SafeSeat for Expo Go over your local Wi-Fi...
echo Phone and laptop must be on the same Wi-Fi.
echo.
call npx expo start --go --lan -c
goto :eof

:fail
echo.
echo Setup stopped because a command failed.
echo Run npm install, then retry this file.
pause
exit /b 1
