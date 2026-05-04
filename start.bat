@echo off
cd /d %~dp0

git add -A
git commit -m "Update to TestZyro v7"

git pull origin main --rebase
IF %ERRORLEVEL% NEQ 0 (
  echo Resolve conflicts, then run:
  echo git add .
  echo git rebase --continue
  pause
  exit /b
)

git push origin main

pause