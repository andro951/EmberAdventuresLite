@echo off
cd /d "%~dp0"
call "Build Diagnostic.bat"
if errorlevel 1 exit /b 1
start "EmberAdventures Persistence Diagnostic" http://127.0.0.1:4178/
node diagnostic-server.js
