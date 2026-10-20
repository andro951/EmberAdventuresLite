@echo off
cd /d "%~dp0"
python -c "import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)" >nul 2>nul
if not errorlevel 1 goto systempython
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" goto bundledpython
py -3 -c "import sys" >nul 2>nul
if not errorlevel 1 goto pylauncher
echo Python 3 was not found. Install Python 3, then reopen this launcher.
pause
exit /b 1
:systempython
python hosting\launch.py %*
goto finished
:bundledpython
"%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" hosting\launch.py %*
goto finished
:pylauncher
py -3 hosting\launch.py %*
:finished
if errorlevel 1 pause
