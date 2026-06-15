@echo off
chcp 65001 >nul
echo ============================================
echo   🌿 健康小记 - 部署到 GitHub Pages
echo ============================================
echo.

cd /d "%~dp0"

echo 📁 当前目录：%CD%
echo.

:: 如果 .git 不存在，初始化仓库
if not exist ".git\" (
    echo 🔧 初始化 Git 仓库...
    git init
    git remote add origin https://github.com/yuni1331/health-journal.git
)

echo 📤 提交更改...
git add .
git commit -m "更新：身份选择 + 零星睡眠 + 吃药记录"

echo 🚀 推送到 GitHub...
git push -u origin main

echo.
echo ============================================
echo ✅ 部署完成！
echo 📱 等待 1-2 分钟后访问：
echo    https://yuni1331.github.io/health-journal/
echo ============================================
pause
