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
$HeadSha = (& git rev-parse --short HEAD).Trim()

$SnapFiles = @(
    "$Root\packages\player\src\views\Plugins\__snapshots__\PluginStore.test.tsx.snap",
    "$Root\packages\player\src\views\Settings\__snapshots__\Settings.test.tsx.snap"
)
foreach ($snapPath in $SnapFiles) {
    if (Test-Path -LiteralPath $snapPath) {
        $rawSnap = [System.IO.File]::ReadAllText($snapPath, [System.Text.Encoding]::UTF8)
        $updatedSnap = $rawSnap -replace 'v\d+\.\d+\.\d+ \([0-9a-f]+\)', "v$CurrentVer ($HeadSha)"
        if ($updatedSnap -ne $rawSnap) {
            [System.IO.File]::WriteAllText($snapPath, $updatedSnap, $utf8NoBom)
        }
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Aurora CI] Verificaciones de calidad previas al release..." -ForegroundColor Cyan
Write-Host " 1/3 Type-check (TypeScript)..." -ForegroundColor Yellow
npx turbo type-check
if ($LASTEXITCODE -ne 0) { throw "Fallo en type-check. Despliegue cancelado." }

Write-Host " 2/3 Lint (ESLint + Prettier)..." -ForegroundColor Yellow
npx turbo lint
if ($LASTEXITCODE -ne 0) { throw "Fallo en linting. Despliegue cancelado." }

Write-Host " 3/3 Tests automáticos (Vitest)..." -ForegroundColor Yellow
npx turbo test
if ($LASTEXITCODE -ne 0) { throw "Fallo en tests automáticos. Despliegue cancelado." }

Write-Host " [OK] Todas las comprobaciones han pasado con exito." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

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
$pkgStr = $rawPkg -replace '"version":\s*".*?"', "`"version`": `"$NextVer`""
[System.IO.File]::WriteAllText($PackageJsonPath, $pkgStr, $utf8NoBom)

# 2. Update packages/player/src-tauri/tauri.conf.json
$TauriConfPath = "$Root\packages\player\src-tauri\tauri.conf.json"
$rawTauri = [System.IO.File]::ReadAllText($TauriConfPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
$tauriStr = $rawTauri -replace '"version":\s*".*?"', "`"version`": `"$NextVer`""
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

# 4a1. Update packages/player/src/hooks/useAppVersion.ts
$AppVersionPath = "$Root\packages\player\src\hooks\useAppVersion.ts"
if (Test-Path $AppVersionPath) {
    $rawAppVer = [System.IO.File]::ReadAllText($AppVersionPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $appVerStr = $rawAppVer -replace "useState<string \| null>\('.*?'\)", "useState<string | null>('$NextVer')"
    [System.IO.File]::WriteAllText($AppVersionPath, $appVerStr, $utf8NoBom)
}

# 4a2. Update packages/player/src/services/apkUpdater.ts
$ApkUpdaterPath = "$Root\packages\player\src\services\apkUpdater.ts"
if (Test-Path $ApkUpdaterPath) {
    $rawApkUpdater = [System.IO.File]::ReadAllText($ApkUpdaterPath, [System.Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $apkUpdaterStr = $rawApkUpdater -replace "version: '.*?'", "version: '$NextVer'" -replace "versionCode: \d+", "versionCode: $code"
    [System.IO.File]::WriteAllText($ApkUpdaterPath, $apkUpdaterStr, $utf8NoBom)
}

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
    $metaDesc = "Release ${NextVer}: Mejoras y correcciones en Aurora."
    $changelogPath = "$Root\packages\player\changelog.json"
    if (Test-Path $changelogPath) {
        try {
            $cl = Get-Content $changelogPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($cl.Count -gt 0 -and $cl[0].description) {
                $metaDesc = "Release ${NextVer}: " + $cl[0].description
            }
        } catch {}
    }
    $newReleaseBlock = "    <release version=`"$NextVer`" date=`"$todayStr`">`n      <description>`n        <p>$metaDesc</p>`n      </description>`n    </release>`n"
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
    $adbCmd = "adb"
    $sdkAdb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
    if (Test-Path -LiteralPath $sdkAdb) {
        $adbCmd = $sdkAdb
    }
    $devices = & $adbCmd devices 2>$null | Where-Object { $_ -match '\bdevice$' }
    if ($devices) {
        foreach ($line in $devices) {
            $serial = ($line -split '\s+')[0]
            if ($serial) {
                Write-Host "[ADB] Dispositivo detectado ($serial). Instalando APK..." -ForegroundColor Cyan
                & $adbCmd -s $serial install -r -d "$Root\ejecutables\aurora-music-player.apk"
                & $adbCmd -s $serial reverse tcp:4122 tcp:4122 2>$null
                $pcSyncFile = Join-Path $env:APPDATA "com.auroraplayer\p2p_sync.json"
                if (Test-Path -LiteralPath $pcSyncFile) {
                    $pcSync = Get-Content -LiteralPath $pcSyncFile -Raw -Encoding UTF8 | ConvertFrom-Json
                    if ($pcSync.gist_token -or $pcSync.gist_id) {
                        Write-Host "[ADB] Sincronizando credenciales GitHub Gist en $serial..." -ForegroundColor Cyan
                        & $adbCmd -s $serial shell am start -n com.auroraplayer.app/.MainActivity --es gist_token "$($pcSync.gist_token)" --es gist_id "$($pcSync.gist_id)" | Out-Null
                    }
                }
            }
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
try {
    if (Test-Path $TargetBin) {
        Copy-Item $TargetBin $InstalledExe -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "[Aviso] No se pudo sobrescribir el ejecutable local instalado (la app de escritorio está en ejecución)." -ForegroundColor Yellow
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
    git tag -a "$Tag" -m "$Tag" -f
    git push origin "$Tag" -f
} catch {
    Write-Host "[Git Tags] Aviso al pushear tags: $_" -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " ¡Versión $NextVer ($Tag) compilada y publicada con éxito!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
