@echo off
setlocal
title Cipher Core Launcher

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-cipher-core.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Cipher Core could not be started. Review the error above.
    pause
)

exit /b %EXIT_CODE%
