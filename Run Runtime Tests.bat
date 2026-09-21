@echo off
setlocal
cd /d "%~dp0"

node build_runtime_tests.js
if errorlevel 1 exit /b %errorlevel%

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\open_runtime_tests.ps1"
