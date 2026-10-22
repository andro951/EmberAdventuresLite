@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File test-host.ps1
pause
