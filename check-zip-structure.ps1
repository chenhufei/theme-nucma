# Check ZIP package structure
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
    Write-Host '=== ZIP Structure Check ===' -ForegroundColor Cyan
    Write-Host ("ZIP File: {0}" -f $zipPath) -ForegroundColor DarkGray
    Write-Host ''

    Write-Host 'Root Files:' -ForegroundColor Yellow
    $rootFiles = $zip.Entries | Where-Object { -not $_.FullName.Contains('/') -and -not $_.FullName.Contains('\\') }
    $rootFiles | ForEach-Object { Write-Host ("  {0}" -f $_.FullName) }

    Write-Host ''
    Write-Host 'templates Directory:' -ForegroundColor Yellow
    $templateFiles = $zip.Entries | Where-Object { $_.FullName -like 'templates/*' -or $_.FullName -like 'templates\*' }
    Write-Host ("  Count: {0}" -f $templateFiles.Count)
    $templateFiles | Select-Object -First 10 | ForEach-Object { Write-Host ("  {0}" -f $_.FullName) }

    Write-Host ''
    Write-Host 'Path Separators:' -ForegroundColor Yellow
    $hasForwardSlash = $zip.Entries | Where-Object { $_.FullName.Contains('/') }
    $hasBackSlash = $zip.Entries | Where-Object { $_.FullName.Contains('\\') }
    Write-Host ("  Using '/': {0}" -f @($hasForwardSlash).Count)
    Write-Host ("  Using '\\': {0}" -f @($hasBackSlash).Count)

    Write-Host ''
    Write-Host 'Flattened Path Check:' -ForegroundColor Yellow
    $flatFiles = $zip.Entries | Where-Object { $_.FullName -like '*\**' -and -not $_.FullName.Contains('/') }
    if ($flatFiles) {
        Write-Host '  [WARN] Potential flattened path issue found.' -ForegroundColor Red
        $flatFiles | Select-Object -First 5 | ForEach-Object { Write-Host ("    {0}" -f $_.FullName) }
    } else {
        Write-Host '  [OK] Structure looks normal.' -ForegroundColor Green
    }

    Write-Host ''
    Write-Host '[DONE] Structure check completed.' -ForegroundColor Green
}
finally {
    $zip.Dispose()
}
