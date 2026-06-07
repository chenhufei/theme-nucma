# Verify theme package
Add-Type -AssemblyName System.IO.Compression.FileSystem

$themeYamlPath = Join-Path $PSScriptRoot 'theme.yaml'
$themeYaml = Get-Content $themeYamlPath -Raw
$versionMatch = [regex]::Match($themeYaml, 'version:\s*"([^"]+)"')

if (-not $versionMatch.Success) {
    throw "Failed to parse version from theme.yaml: $themeYamlPath"
}

$version = $versionMatch.Groups[1].Value
$zipPath = Join-Path $PSScriptRoot ("dist\theme-nucma-{0}.zip" -f $version)

if (-not (Test-Path $zipPath)) {
    throw "ZIP package not found: $zipPath"
}

$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)

try {
    Write-Host '=== Verify Theme Package ===' -ForegroundColor Cyan
    Write-Host ("ZIP File: {0}" -f $zipPath) -ForegroundColor DarkGray
    Write-Host ''

    Write-Host '=== Root Files ===' -ForegroundColor Cyan
    $rootFiles = $zip.Entries | Where-Object { -not $_.FullName.Contains('/') }
    $rootFiles | Select-Object FullName | Format-Table

    Write-Host ''
    Write-Host '=== Required Files ===' -ForegroundColor Cyan
    $required = @('theme.yaml', 'settings.yaml')
    foreach ($file in $required) {
        $exists = $zip.Entries | Where-Object { $_.FullName -eq $file }
        if ($exists) {
            Write-Host ("[OK] {0}" -f $file) -ForegroundColor Green
        } else {
            Write-Host ("[MISSING] {0}" -f $file) -ForegroundColor Red
        }
    }

    Write-Host ''
    Write-Host '=== templates Directory ===' -ForegroundColor Cyan
    $templates = $zip.Entries | Where-Object { $_.FullName -like 'templates/*' }
    Write-Host ("Count: {0}" -f $templates.Count)

    Write-Host ''
    Write-Host '=== i18n Directory ===' -ForegroundColor Cyan
    $i18n = $zip.Entries | Where-Object { $_.FullName -like 'i18n/*' }
    Write-Host ("Count: {0}" -f $i18n.Count)

    Write-Host ''
    Write-Host '=== First 20 Entries ===' -ForegroundColor Cyan
    $zip.Entries | Select-Object -First 20 | ForEach-Object { Write-Host ("  {0}" -f $_.FullName) }

    Write-Host ''
    Write-Host '[DONE] Verification completed.' -ForegroundColor Green
}
finally {
    $zip.Dispose()
}
