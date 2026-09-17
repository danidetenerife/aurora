$ErrorActionPreference = "Stop"

$avdDir = "$env:USERPROFILE\.android\avd\Aurora_Mobile.avd"
$emuExe = "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
$adbExe = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$root = Resolve-Path "$PSScriptRoot\.."

Write-Host "=== Iniciando entorno Android Mobile (Modo Interactivo en Pantalla) ===" -ForegroundColor Cyan

# 1. Limpiar bloqueos residuales de QEMU
if (Test-Path $avdDir) {
    Write-Host "[1/5] Verificando y limpiando bloqueos residuales..." -ForegroundColor Yellow
    Get-ChildItem -Path $avdDir -Force | Where-Object { $_.Name -like "*lock*" } | ForEach-Object {
        Write-Host " Eliminando bloqueo: $($_.Name)" -ForegroundColor Yellow
        Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 2. Iniciar el emulador mediante Shell.Application (en el escritorio interactivo del usuario con ventana visible)
Write-Host "[2/5] Lanzando emulador Aurora_Mobile en el escritorio interactivo..." -ForegroundColor Cyan
$emuDir = "$env:LOCALAPPDATA\Android\Sdk\emulator"
$sh = New-Object -ComObject Shell.Application
$sh.ShellExecute($emuExe, "-avd Aurora_Mobile", $emuDir, "open", 1)

Write-Host " Emulador lanzado en el escritorio interactivo. Esperando conexion ADB..." -ForegroundColor Green

# 3. Esperar a que el dispositivo esté listo
Write-Host "[3/5] Esperando a que el sistema operativo Android Mobile complete el arranque..." -ForegroundColor Yellow
& $adbExe wait-for-device

$bootComplete = $false
for ($i = 0; $i -lt 40; $i++) {
    $val = (& $adbExe shell getprop sys.boot_completed 2>$null)
    if ($val) { $val = $val.Trim() }
    if ($val -eq "1") {
        $bootComplete = $true
        Write-Host " Android Mobile ha arrancado con exito (sys.boot_completed = 1)!" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 3
}

# 4. Instalar APK
$apkPath = "$root\ejecutables\aurora-music-player.apk"
if (Test-Path $apkPath) {
    Write-Host "[4/5] Instalando la APK de Aurora ($apkPath)..." -ForegroundColor Cyan
    & $adbExe install -r -d $apkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host " APK instalada correctamente en el emulador móvil!" -ForegroundColor Green
    }
}

# 5. Desbloquear pantalla y lanzar Aurora
Write-Host "[5/5] Desbloqueando pantalla e iniciando Aurora..." -ForegroundColor Cyan
& $adbExe shell input keyevent 82
& $adbExe shell am start -n com.auroraplayer.app/.MainActivity
Start-Sleep -Seconds 3

Write-Host "=== Emulador Android Móvil listo y visible en pantalla con Aurora ===" -ForegroundColor Green
