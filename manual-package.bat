@echo off
REM 手动打包主题
REM 避免使用 theme-package CLI

cd /d "%~dp0"
echo 📦 开始打包 theme-nucma...

REM 读取版本号
for /f "tokens=2 delims= " %%i in ('findstr "version:" theme.yaml') do set VERSION=%%i
set VERSION=%VERSION:"=%
echo 📌 版本: %VERSION%

REM 创建临时目录
if exist temp-package rmdir /s /q temp-package
mkdir temp-package

REM 复制必需文件
echo 📄 复制文件...
copy /y theme.yaml temp-package\
copy /y settings.yaml temp-package\
copy /y LICENSE temp-package\
xcopy /e /i /y templates temp-package\templates
xcopy /e /i /y i18n temp-package\i18n

REM 打包
echo 📦 创建 ZIP...
cd temp-package
powershell -Command "$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path * -DestinationPath ..\dist\theme-nucma-%VERSION%.zip -CompressionLevel Optimal -Force"
cd ..

REM 清理
rmdir /s /q temp-package

echo ✅ 打包完成: dist\theme-nucma-%VERSION%.zip
