@echo off
cd /d "%~dp0"
echo Starting build...
echo.

echo Step 1: Copy JS files...
node scripts\build.js
if errorlevel 1 goto error

echo.
echo Step 2: Build CSS with Vite...
node_modules\.bin\vite.cmd build
if errorlevel 1 goto error

echo.
echo Step 3: Package theme...
node_modules\.bin\theme-package.cmd
if errorlevel 1 goto error

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
goto end

:error
echo.
echo ========================================
echo Build failed!
echo ========================================
exit /b 1

:end
