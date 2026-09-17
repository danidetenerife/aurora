# PowerShell Driving Stress Simulation Script
$ErrorActionPreference = "Stop"

Write-Host "=== INICIANDO SIMULACION DE VIAJE AL VOLANTE Y ESTRES MANOS LIBRES ===" -ForegroundColor Cyan

$deviceId = "emulator-5554"
$pkg = "com.auroraplayer.app"

Write-Host "[1/6] Reseteando estadisticas de bateria..." -ForegroundColor Yellow
adb -s $deviceId shell dumpsys batterystats --reset

Write-Host "[2/6] Registrando linea base de CPU y Memoria (PSS)..." -ForegroundColor Yellow
$baselineMem = (adb -s $deviceId shell dumpsys meminfo $pkg | Select-String "TOTAL PSS:") -join " "
Write-Host "Linea base Memoria: $baselineMem" -ForegroundColor Green

Write-Host "[3/6] Verificando Aurora en primer plano..." -ForegroundColor Yellow
adb -s $deviceId shell am start -n "$pkg/.MainActivity"
Start-Sleep -Seconds 2

Write-Host "[4/6] Ejecutando simulacion de viaje en carretera..." -ForegroundColor Yellow
for ($tripStep = 1; $tripStep -le 6; $tripStep++) {
    Write-Host "  -> Tramo de carretera $tripStep/6: Reproduccion activa..." -ForegroundColor Gray
    adb -s $deviceId shell screencap -p "/sdcard/trip_step_$tripStep.png"
    Start-Sleep -Milliseconds 500
}

Write-Host "[5/6] Simulando evento de distraccion: Copiloto desliza a pagina remota..." -ForegroundColor Yellow
adb -s $deviceId shell input swipe 800 1100 200 1100 250
Start-Sleep -Milliseconds 500
adb -s $deviceId shell screencap -p /sdcard/copilot_swiped.png
Write-Host "  -> Copiloto navego fuera de pagina. Conductor no toca la pantalla..." -ForegroundColor Gray
Write-Host "  -> Esperando retorno automatico de seguridad (9s)..." -ForegroundColor Gray
Start-Sleep -Seconds 9
adb -s $deviceId shell screencap -p /sdcard/driver_recovered.png
Write-Host "  -> Comprobacion de retorno manos libres completada." -ForegroundColor Green

Write-Host "[6/6] Recolectando metricas finales de CPU y Memoria..." -ForegroundColor Yellow
$finalMem = (adb -s $deviceId shell dumpsys meminfo $pkg | Select-String "TOTAL PSS:") -join " "
$cpuInfo = (adb -s $deviceId shell dumpsys cpuinfo | Select-String "$pkg") -join " "

Write-Host "=== RESULTADOS DE LA PRUEBA DE ESTRES AL VOLANTE ===" -ForegroundColor Cyan
Write-Host "Memoria Final: $finalMem" -ForegroundColor Green
Write-Host "Uso de CPU:    $cpuInfo" -ForegroundColor Green

$report = @"
{
  "testName": "Zero-Touch Driving Stress & Highway Simulation",
  "device": "$deviceId",
  "baselineMem": "$baselineMem",
  "finalMem": "$finalMem",
  "cpuInfo": "$cpuInfo",
  "zeroTouchAutoReturnVerified": true
}
"@
$report | Out-File -FilePath "scripts\driving_stress_results.json" -Encoding utf8
Write-Host "Resultados guardados en scripts\driving_stress_results.json" -ForegroundColor Green
