@echo off
REM Echo — push main to GitHub via SSH (see .cursor/skills/git-push-github-ssh/SKILL.md)
cd /d C:\Users\天昊\Desktop\Echo

echo.
echo [1/3] Testing GitHub SSH (expect: Hi username! You've successfully authenticated)...
echo.
ssh -T git@github.com
echo.
echo Note: GitHub SSH test often returns exit code 1 even when authentication succeeded.
echo.

echo [2/3] Setting origin to SSH...
git remote set-url origin git@github.com:yth-pass/Echo.git

echo.
echo [3/3] Pushing main...
git push origin main

if errorlevel 1 (
  echo.
  echo Push failed. Fix SSH first, then re-run this script.
  exit /b 1
)

echo.
echo Done.
exit /b 0
