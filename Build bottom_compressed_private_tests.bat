@echo off
setlocal
cd /d "%~dp0"
node build_bottom_compressed.js --private-tests
set "BUILD_EXIT_CODE=%ERRORLEVEL%"
pause
exit /b %BUILD_EXIT_CODE%
