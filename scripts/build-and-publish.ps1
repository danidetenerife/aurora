param(
    [string]$CustomVersion = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot\.."
Set-Location $Root

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Read current version from packages/player/package.json
$PackageJsonPath = "$Root\packages\player\package.json"
$rawPkg = [System.IO.File]::ReadAllText($PackageJsonPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$PackageJson = $rawPkg | ConvertFrom-Json
$CurrentVer = $PackageJson.version

# Compute next version
if ($CustomVersion -ne "") {
    $NextVer = $CustomVersion.Replace("v", "")
} else {
    $parts = $CurrentVer.Split('.')
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2] + 1
    $NextVer = "$major.$minor.$patch"
}

$Tag = "v$NextVer"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Aurora CI] Subiendo de versión: $CurrentVer -> $NextVer ($Tag)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Update packages/player/package.json
$PackageJson.version = $NextVer
$pkgStr = ($PackageJson | ConvertTo-Json -Depth 10)
[System.IO.File]::WriteAllText($PackageJsonPath, $pkgStr, $utf8NoBom)

# 2. Update packages/player/src-tauri/tauri.conf.json
$TauriConfPath = "$Root\packages\player\src-tauri\tauri.conf.json"
$rawTauri = [System.IO.File]::ReadAllText($TauriConfPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$TauriConf = $rawTauri | ConvertFrom-Json
$TauriConf.version = $NextVer
$tauriStr = ($TauriConf | ConvertTo-Json -Depth 10)
[System.IO.File]::WriteAllText($TauriConfPath, $tauriStr, $utf8NoBom)

# 3. Update packages/player/src/stores/updaterStore.ts
$UpdaterStorePath = "$Root\packages\player\src\stores\updaterStore.ts"
$rawUpdater = [System.IO.File]::ReadAllText($UpdaterStorePath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$updaterStr = $rawUpdater -replace "const CURRENT_VERSION = '.*?';", "const CURRENT_VERSION = '$NextVer';"
[System.IO.File]::WriteAllText($UpdaterStorePath, $updaterStr, $utf8NoBom)

# 4. Update packages/player/android/app/build.gradle
$BuildGradlePath = "$Root\packages\player\android\app\build.gradle"
$rawGradle = [System.IO.File]::ReadAllText($BuildGradlePath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$partsVer = $NextVer.Split('.')
$code = [int]$partsVer[0]*10000 + [int]$partsVer[1]*100 + [int]$partsVer[2]
$gradleStr = $rawGradle -replace 'versionName ".*?"', "versionName `"$NextVer`"" -replace 'versionCode \d+', "versionCode $code"
[System.IO.File]::WriteAllText($BuildGradlePath, $gradleStr, $utf8NoBom)

# 4b. Update packages/website/src/data/version.ts
$WebsiteVersionPath = "$Root\packages\website\src\data\version.ts"
if (Test-Path $WebsiteVersionPath) {
    $rawWebVer = [System.IO.File]::ReadAllText($WebsiteVersionPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $webVerStr = $rawWebVer -replace "export const version = '.*?';", "export const version = '$NextVer';"
    [System.IO.File]::WriteAllText($WebsiteVersionPath, $webVerStr, $utf8NoBom)
}

# 4c. Update metainfo.xml
$MetainfoPath = "$Root\packages\player\src-tauri\resources\com.auroraplayer.Aurora.metainfo.xml"
if (Test-Path $MetainfoPath) {
    $rawMeta = [System.IO.File]::ReadAllText($MetainfoPath, [System.Text.Encoding]::UTF8)
    $todayStr = (Get-Date).ToString("yyyy-MM-dd")
    $newReleaseBlock = "    <release version=`"$NextVer`" date=`"$todayStr`">`n      <description>`n        <p>Release ${NextVer}: Resolución total de carátulas en Historial y Listas, función Álbum Favorito en toda la UI, virtualización de cola y optimización extrema de rendimiento en escritorio.</p>`n      </description>`n    </release>`n"
    $metaStr = $rawMeta -replace "<releases>", "<releases>`n$newReleaseBlock"
    [System.IO.File]::WriteAllText($MetainfoPath, $metaStr, $utf8NoBom)
}

# 5. Build frontend
Write-Host "[1/4] Compilando Frontend..." -ForegroundColor Yellow
npx pnpm --filter @aurora/player build:frontend

# 6. Build Android APK
Write-Host "[2/4] Compilando Android APK..." -ForegroundColor Yellow
cmd.exe /c "cd packages\player && npx cap sync android && android\build-apk.bat"

# 6b. Install to Android device if connected
try {
    $devices = & adb devices 2>$null | Where-Object { $_ -match '\bdevice$' }
    if ($devices) {
        Write-Host "[ADB] Dispositivo Android detectado. Instalando APK en el móvil..." -ForegroundColor Cyan
        & adb install -r -d "$Root\ejecutables\aurora-music-player.apk"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[ADB] ¡APK instalado exitosamente en el móvil!" -ForegroundColor Green
        } else {
            Write-Host "[ADB] Aviso: adb install finalizó con código $LASTEXITCODE" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "[ADB] Error intentando instalar con adb: $_" -ForegroundColor Yellow
}

# 7. Build Tauri Desktop EXE
Write-Host "[3/4] Compilando instalador Windows..." -ForegroundColor Yellow
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
$SigningKeyPath = Join-Path $env:USERPROFILE ".tauri\aurora-updater.key"
$SigningPasswordPath = Join-Path $env:USERPROFILE ".tauri\aurora-updater.password"

if (-not (Test-Path -LiteralPath $SigningKeyPath) -or -not (Test-Path -LiteralPath $SigningPasswordPath)) {
    $LegacyKeyPath = Join-Path $env:USERPROFILE ".tauri\aurora-updater.key"
    $LegacyPasswordPath = Join-Path $env:USERPROFILE ".tauri\aurora-updater.password"
    if ((Test-Path -LiteralPath $LegacyKeyPath) -and (Test-Path -LiteralPath $LegacyPasswordPath)) {
        Copy-Item $LegacyKeyPath $SigningKeyPath -Force
        Copy-Item $LegacyPasswordPath $SigningPasswordPath -Force
        $LegacyPubPath = Join-Path $env:USERPROFILE ".tauri\aurora-updater.key.pub"
        $SigningPubPath = Join-Path $env:USERPROFILE ".tauri\aurora-updater.key.pub"
        if (Test-Path -LiteralPath $LegacyPubPath) {
            Copy-Item $LegacyPubPath $SigningPubPath -Force
        }
    } else {
        throw "No se encontró la clave de firma del actualizador en $SigningKeyPath"
    }
}

$env:TAURI_SIGNING_PRIVATE_KEY = [System.IO.File]::ReadAllText($SigningKeyPath).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.IO.File]::ReadAllText($SigningPasswordPath).Trim()
Set-Location "$Root\packages\player"
cmd.exe /c "pnpm tauri build"
if ($LASTEXITCODE -ne 0) {
    throw "La compilación firmada de escritorio ha fallado."
}
Set-Location $Root

# Copy setup exe to executables
$GeneratedExe = "$Root\packages\player\src-tauri\target\release\bundle\nsis\Aurora_${NextVer}_x64-setup.exe"
if (-not (Test-Path $GeneratedExe)) {
    $GeneratedExe = "$Root\packages\player\src-tauri\target\release\bundle\nsis\Aurora_${NextVer}_x64-setup.exe"
}
$DestExe = "$Root\ejecutables\Aurora_${NextVer}_x64-setup.exe"
if (Test-Path $GeneratedExe) {
    Copy-Item $GeneratedExe $DestExe -Force
}

$InstalledExe = "C:\Users\Danid\AppData\Local\Aurora\aurora-music-player.exe"
$TargetBin = "$Root\packages\player\src-tauri\target\release\aurora-music-player.exe"
if (Test-Path $TargetBin) {
    Copy-Item $TargetBin $InstalledExe -Force -ErrorAction SilentlyContinue
}

$GeneratedSignature = "$GeneratedExe.sig"
if (-not (Test-Path -LiteralPath $GeneratedSignature)) {
    throw "No se generó la firma del actualizador de escritorio."
}

# 8. Sync Git and Publish Release
Write-Host "[4/4] Subiendo a GitHub y publicando Release $Tag..." -ForegroundColor Green

$releaseNotes = ""
$changelogPath = "$Root\packages\player\changelog.json"
if (Test-Path $changelogPath) {
    try {
        $changelog = Get-Content $changelogPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($changelog.Count -gt 0 -and $changelog[0].description) {
            $releaseNotes = "Aurora Music Player ${Tag}: " + $changelog[0].description
        }
    } catch {}
}

powershell.exe -ExecutionPolicy Bypass -File "$Root\scripts\auto-sync-github.ps1"
powershell.exe -ExecutionPolicy Bypass -File "$Root\scripts\publish-release.ps1" -Version $NextVer -Notes "$releaseNotes"

try {
    git tag -a "player@$NextVer" -m "player@$NextVer" -f
    git push origin "player@$NextVer"
    git push origin "$Tag"
} catch {
    Write-Host "[Git Tags] Aviso al pushear tags: $_" -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ¡Versión $NextVer ($Tag) compilada y publicada con éxito!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
