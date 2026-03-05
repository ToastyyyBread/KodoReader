@echo off
title Kodo Launcher

:: Switch to the directory where this batch file is located
cd /d "%~dp0"

echo =======================================
echo          Starting KODO App...
echo =======================================
echo.

echo [1/2] Starting Backend Server...
start "Kodo Backend Server (Port 5000)" cmd /k "cd server && npm run dev"

echo [2/2] Starting Frontend Client...
start "Kodo Frontend Client (Port 5173)" cmd /k "cd client && npm run dev"

echo.
echo Both servers are starting!
echo The web browser should open automatically or you can open: http://localhost:5173
echo.
echo You can close this launcher window now.
timeout /t 5 >nul
exit
