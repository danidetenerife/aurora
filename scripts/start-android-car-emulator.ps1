$ErrorActionPreference = "Stop"

$avdDir = "$env:USERPROFILE\.android\avd\Android_Auto_Car.avd"
$emuExe = "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
$root = Resolve-Path "$PSScriptRoot\.."

Write-Host "=== Iniciando entorno Android Auto / Automotive (Modo Persistente) ===" -ForegroundColor Cyan

# 1. Limpiar bloqueos residuales de QEMU
if (Test-Path $avdDir) {
    Write-Host "[1/5] Verificando y limpiando bloqueos residuales..." -ForegroundColor Yellow
    Get-ChildItem -Path $avdDir -Force | Where-Object { $_.Name -like "*lock*" } | ForEach-Object {
        Write-Host " Eliminando bloqueo huérfano: $($_.Name)" -ForegroundColor Yellow
        Remove-Item -Path $_.FullName -Recurse -Force
    }
}

# 2. Iniciar el emulador mediante Shell.Application (desacoplado en el escritorio interactivo del usuario)
Write-Host "[2/5] Lanzando emulador Android_Auto_Car en el escritorio interactivo..." -ForegroundColor Cyan
$emuDir = "$env:LOCALAPPDATA\Android\Sdk\emulator"
$sh = New-Object -ComObject Shell.Application
$sh.ShellExecute($emuExe, "-avd Android_Auto_Car", $emuDir, "open", 1)

Write-Host " Emulador lanzado en segundo plano. Esperando conexion ADB..." -ForegroundColor Green

# 3. Esperar a que el dispositivo esté listo
Write-Host "[3/5] Esperando a que el sistema operativo Android Automotive complete el arranque..." -ForegroundColor Yellow
& adb wait-for-device

$bootComplete = $false
for ($i = 0; $i -lt 40; $i++) {
    $val = (& adb shell getprop sys.boot_completed 2>$null)
    if ($val) { $val = $val.Trim() }
    if ($val -eq "1") {
        $bootComplete = $true
        Write-Host " Android Automotive ha arrancado con exito (sys.boot_completed = 1)!" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 3
}

if (-not $bootComplete) {
    Write-Warning "El tiempo de espera de arranque expiro, procediendo a verificar estado..."
}

# 4. Instalar APK
$apkPath = "$root\ejecutables\aurora-music-player.apk"
if (Test-Path $apkPath) {
    Write-Host "[4/5] Instalando la APK de Aurora ($apkPath)..." -ForegroundColor Cyan
    & adb install -r -d $apkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host " APK instalada correctamente en el emulador!" -ForegroundColor Green
    } else {
        Write-Warning "adb install devolvio codigo $LASTEXITCODE"
    }
} else {
    Write-Warning "No se encontro $apkPath"
}

# 5. Iniciar Aurora
Write-Host "[5/5] Iniciando Aurora en Android Automotive..." -ForegroundColor Cyan
& adb shell am start -n com.auroraplayer.app/.MainActivity
Start-Sleep -Seconds 3

Write-Host "=== Entorno Android Auto listo y operativo de forma permanente ===" -ForegroundColor Green
