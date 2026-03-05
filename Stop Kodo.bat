@echo off
title Stopping Kodo App

echo =======================================
echo          Stopping KODO App...
echo =======================================
echo.

echo Stopping Frontend and Backend Servers...
:: Menghentikan proses berdasarkan judul Window (Window Title) dari Start Kodo.bat
taskkill /F /FI "WINDOWTITLE eq Kodo Backend Server*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Kodo Frontend Client*" /T >nul 2>&1

echo.
echo Kodo App has been stopped successfully!
timeout /t 3 >nul
exit
