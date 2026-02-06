@echo off
setlocal

cd /d "%~dp0"

echo [CrafterForumNext] Starting Production Server...
echo.
echo ===============================================
echo  Build and run at: http://localhost:3000
echo ===============================================
echo.

set NODE_ENV=production
set AUTH_TRUST_HOST=true

call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Production build failed. Server was not started.
  pause
  exit /b 1
)

call npm run start

endlocal
