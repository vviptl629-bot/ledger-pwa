@echo off
REM ============================================================
REM  账本一键同步到 GitHub Pages（vviptl629-bot/ledger-pwa）
REM  用法 A（文件管理器双击）: sync_github.bat ghp_你的token
REM  用法 B（Git Bash）:        ./sync_github.bat ghp_你的token
REM  说明: token 仅用于本次推送命令，推完立即还原 remote，不写入仓库配置
REM ============================================================
if "%1"=="" (
  echo 用法: sync_github.bat ^<github_token^>
  echo 例:   sync_github.bat ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  pause
  exit /b 1
)
set TOKEN=%1
cd /d %~dp0

REM 1) 有改动先提交
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git -c user.name="vviptl629-bot" -c user.email="bot@vviptl629-bot.io" commit -m "chore: auto-sync %date% %time%"
)

REM 2) 推送（token 作 user:password，禁用 credential helper 防提示）
echo === 推送到 GitHub (token 不落盘) ===
git -c credential.helper= push "https://%TOKEN%:%TOKEN%@github.com/vviptl629-bot/ledger-pwa.git" main

REM 3) 还原 remote 为无 token 地址 + 修正 branch 跟踪，杜绝 token 泄漏
git remote set-url origin "https://github.com/vviptl629-bot/ledger-pwa.git"
git config branch.main.remote origin
git config branch.main.merge refs/heads/main

echo.
echo 完成。30-60 秒后强刷 https://vviptl629-bot.github.io/ledger-pwa/
echo 验证 .git/config 无 token:
findstr /C:"ghp_" .git/config >nul 2>&1 && echo   [警告] 仍有 token 残留! || echo   [OK] config 干净
pause
