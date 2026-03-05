@echo off
setlocal

set "TARGET=src-tauri\bin\node.exe"
if not exist src-tauri\bin mkdir src-tauri\bin

for /f "delims=" %%I in ('where node 2^>nul') do (
  copy /Y "%%I" "%TARGET%" >nul
  exit /b 0
)

echo Failed to locate node.exe on PATH. 1>&2
exit /b 1
