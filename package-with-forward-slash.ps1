#!/usr/bin/env pwsh
# 使用 .NET API 创建 ZIP，确保路径格式正确

$ErrorActionPreference = "Stop"

# 设置路径
$rootDir = Get-Location
$version = (Select-String -Path "theme.yaml" -Pattern "version:" | Select-Object -First 1).ToString().Split(":")[1].Trim().Replace('"', '').Trim()

Write-Host "📦 开始打包 theme-nucma..." -ForegroundColor Cyan
Write-Host "📌 版本: $version" -ForegroundColor Yellow

# 创建临时目录
$tempDir = "$rootDir\temp-package"
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}
New-Item -Path $tempDir -ItemType Directory | Out-Null

# 复制文件
Write-Host "📄 复制文件..." -ForegroundColor Yellow
Copy-Item -Path "theme.yaml" -Destination "$tempDir\theme.yaml" -Force
Copy-Item -Path "settings.yaml" -Destination "$tempDir\settings.yaml" -Force
Copy-Item -Path "LICENSE" -Destination "$tempDir\LICENSE" -Force

# 使用正确的路径复制文件夹
Copy-Item -Path "templates" -Destination "$tempDir\templates" -Recurse -Force
Copy-Item -Path "i18n" -Destination "$tempDir\i18n" -Recurse -Force

# 创建 ZIP - 使用 .NET API 确保路径格式正确
Write-Host "📦 创建 ZIP..." -ForegroundColor Yellow
$zipPath = "$rootDir\dist\theme-nucma-$version.zip"

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

# 添加文件
Get-ChildItem -Path "$tempDir\*" -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($tempDir.Length + 1)
    # 将反斜杠转换为正斜杠
    $entryPath = $relativePath.Replace('\', '/')
    Write-Host "  添加: $entryPath" -ForegroundColor Gray
    
    $entry = $zip.CreateEntry($entryPath)
    $fileStream = $_.OpenRead()
    $entryStream = $entry.Open()
    $fileStream.CopyTo($entryStream)
    $entryStream.Close()
    $fileStream.Close()
}

$zip.Dispose()

# 清理
Remove-Item -Path $tempDir -Recurse -Force

Write-Host ""
Write-Host "✅ 打包完成: $zipPath" -ForegroundColor Green
Write-Host "📏 文件大小: $([math]::Round((Get-Item $zipPath).Length / 1KB, 2)) KB" -ForegroundColor Cyan
