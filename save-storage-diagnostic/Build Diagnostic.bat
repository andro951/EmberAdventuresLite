@echo off
cd /d "%~dp0"
node build-schema-contract.js
if errorlevel 1 pause
