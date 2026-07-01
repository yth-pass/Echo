@echo off
REM Echo — one-click Phase 1 full demo (API + Worker + echo web)
REM Prereqs: Neon/Upstash .env configured; npm install done once.
REM See infra/README-native-windows.md and README.md section 7.1a

setlocal EnableExtensions
cd /d "%~dp0"
set "REPO=%CD%"

echo.
echo Echo demo launcher — repo: %REPO%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 20+ and retry.
  pause
  exit /b 1
)

if not exist "%REPO%\services\api\.env" (
  echo [ERROR] Missing services\api\.env
  echo Copy services\api\.env.example and set DATABASE_URL / REDIS_URL.
  echo See infra\README-native-windows.md
  pause
  exit /b 1
)

if not exist "%REPO%\services\worker\.env" (
  echo [ERROR] Missing services\worker\.env
  echo DATABASE_URL and REDIS_URL must match services\api\.env
  pause
  exit /b 1
)

if not exist "%REPO%\echo\.env.local" (
  echo [WARN] Missing echo\.env.local — web may use mock data only.
  echo Create echo\.env.local with: VITE_API_BASE_URL=http://localhost:4000/v1
  echo.
  timeout /t 3 /nobreak >nul
)

echo Starting Echo API ^(port 4000^)...
start "Echo API" cmd /k "cd /d "%REPO%\services\api" && npm run start:dev"

echo Starting Echo Worker...
start "Echo Worker" cmd /k "cd /d "%REPO%\services\worker" && npm run start:dev"

echo Starting Echo Web ^(port 3000^)...
start "Echo Web" cmd /k "cd /d "%REPO%\echo" && npm run dev"

echo.
echo Waiting for services to listen ^(~8s^)...
timeout /t 8 /nobreak >nul

echo Opening http://localhost:3000
start "" "http://localhost:3000"

echo.
echo Done. Three CMD windows should be running: Echo API, Echo Worker, Echo Web.
echo Close those windows to stop the demo.
echo OTP dev code is usually 123456 ^(see services\api\.env OTP_DEV_CODE^).
echo.
pause
endlocal
