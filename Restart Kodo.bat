@echo off
title Restarting Kodo App
setlocal enabledelayedexpansion

:: Switch to the directory where this batch file is located
cd /d "%~dp0"

echo =======================================
echo          Restarting KODO App...
echo =======================================
echo.

echo [1/3] Stopping existing processes...
:: Kill processes by window title
taskkill /F /FI "WINDOWTITLE eq Kodo Backend Server*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Kodo Frontend Client*" /T >nul 2>&1
:: Also kill any lingering node processes if needed, but the WindowTitle is safer
timeout /t 2 /nobreak >nul

echo [2/3] Starting Backend Server...
start "Kodo Backend Server (Port 5000)" cmd /k "cd server && npm run dev"

echo [3/3] Starting Frontend Client...
start "Kodo Frontend Client (Port 5173)" cmd /k "cd client && npm run dev"

echo.
echo =======================================
echo    Kodo App has been restarted!
echo =======================================
echo Web: http://localhost:5173
echo.
timeout /t 5 >nul
exit
