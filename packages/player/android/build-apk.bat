@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0"
call gradlew.bat assembleDebug
if not exist "%~dp0..\..\..\ejecutables" mkdir "%~dp0..\..\..\ejecutables"
if exist "app\build\outputs\apk\debug\app-debug.apk" (
    copy /y "app\build\outputs\apk\debug\app-debug.apk" "%~dp0..\..\..\ejecutables\aurora-music-player.apk"
    copy /y "app\build\outputs\apk\debug\app-debug.apk" "%~dp0..\..\..\ejecutables\aurora-google-tv.apk"
    copy /y "app\build\outputs\apk\debug\app-debug.apk" "%~dp0..\..\..\aurora-music-player.apk"
)
