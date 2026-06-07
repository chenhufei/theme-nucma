#!/usr/bin/env pwsh

# Halo 主题构建脚本
# 使用 @halo-dev/theme-package-cli 打包

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

Write-Host "🔨 开始构建 Nucma 主题..." -ForegroundColor Cyan

# 检查 node_modules
if (!(Test-Path "node_modules")) {
    Write-Host "📦 安装依赖..." -ForegroundColor Yellow
    pnpm install
}

# 执行构建
Write-Host "📦 打包主题..." -ForegroundColor Yellow
pnpm exec theme-package

if ($LASTEXITCODE -eq 0) {
    $zipFile = Get-ChildItem dist -Filter "*.zip" | Select-Object -First 1
    if ($zipFile) {
        Write-Host "✅ 构建成功！" -ForegroundColor Green
        Write-Host "📦 输出文件: $($zipFile.FullName)" -ForegroundColor Green
        Write-Host "📊 文件大小: $([math]::Round($zipFile.Length / 1KB, 2)) KB" -ForegroundColor Green
    }
} else {
    Write-Host "❌ 构建失败！" -ForegroundColor Red
}

Pop-Location
