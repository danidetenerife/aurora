@echo off
set "PATH=%LOCALAPPDATA%\Android\Sdk\emulator;%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%"
cd /d "%LOCALAPPDATA%\Android\Sdk\emulator"
"%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe" -avd Aurora_Mobile -gpu host
