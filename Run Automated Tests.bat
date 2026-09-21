@echo off
cd /d "%~dp0"
if not exist node_modules\playwright call npm install
call npm test
pause
