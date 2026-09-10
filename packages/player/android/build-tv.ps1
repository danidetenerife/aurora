$ErrorActionPreference = 'Stop'
$tvWorkspace = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Push-Location $tvWorkspace
try {
    pnpm --filter '@nuclearplayer/player' build:frontend
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    pnpm --filter '@nuclearplayer/player' exec cap copy android
    if ($LASTEXITCODE -ne 0) { throw 'Android assets copy failed' }
    Push-Location $PSScriptRoot
    try {
        & './gradlew.bat' ':app:assembleDebug'
        if ($LASTEXITCODE -ne 0) { throw 'APK build failed' }
    } finally { Pop-Location }
    $tvOutput = Join-Path $tvWorkspace 'ejecutables'
    New-Item -ItemType Directory -Path $tvOutput -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'app/build/outputs/apk/debug/app-debug.apk') -Destination (Join-Path $tvOutput 'aurora-google-tv.apk')
    Get-FileHash -LiteralPath (Join-Path $tvOutput 'aurora-google-tv.apk') -Algorithm SHA256
} finally { Pop-Location }
