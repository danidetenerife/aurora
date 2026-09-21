$serial = "emulator-5554"
Write-Host "=== BRUTAL GOOGLE TV STRESS TEST ON AURORA ===" -ForegroundColor Cyan

# Bring Aurora to front
adb -s $serial shell "monkey -p com.auroraplayer.app -c android.intent.category.LAUNCHER 1"
Start-Sleep -Seconds 2

# Clear logcat
adb -s $serial logcat -c

Write-Host "Phase 1: Rapid Spatial D-Pad Navigation Loops..." -ForegroundColor Yellow
$navKeys = @(
    19, 19, 19, 21, 21, # UP to top, LEFT to nav rail
    20, 66,             # DOWN, ENTER
    22, 22, 20, 20,     # RIGHT, DOWN into content
    21, 21,             # LEFT back to rail
    20, 66,             # DOWN, ENTER
    22, 20, 19, 21,     # Move around, back to rail
    19, 19, 66,         # UP to Inicio, ENTER
    22, 66, 22, 66,     # Navigate mood chips and select
    20, 22, 22, 22, 20, # Navigate cards on shelf 1 & 2
    21, 21, 21, 20,     # Return left and down to shelf 3
    22, 20, 19, 21      # Move and back to rail
)

for ($i = 1; $i -le 5; $i++) {
    Write-Host "  Spatial loop $i / 5..." -ForegroundColor Gray
    foreach ($k in $navKeys) {
        adb -s $serial shell "input keyevent $k"
    }
}
Write-Host "Spatial loops completed successfully!" -ForegroundColor Green

Write-Host "Phase 2: Running 2,000 Monkey Stress Events..." -ForegroundColor Yellow
adb -s $serial shell "monkey -p com.auroraplayer.app -c android.intent.category.LAUNCHER --throttle 15 --pct-nav 45 --pct-majornav 35 --pct-touch 10 --pct-syskeys 0 --pct-appswitch 0 --pct-anyevent 10 -v 2000"

Write-Host "Phase 3: Verifying Logcat for Crashes, ANRs, or Exceptions..." -ForegroundColor Yellow
$errors = adb -s $serial logcat -d | Select-String -Pattern "FATAL EXCEPTION|ANR in com.auroraplayer.app|AndroidRuntime: FATAL"
if ($errors) {
    Write-Host "FAILED: Crashes detected!" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    exit 1
} else {
    Write-Host "STRESS TEST PASSED: 0 CRASHES, 0 ANRs, 0 FATAL EXCEPTIONS!" -ForegroundColor Green
}

Write-Host "Phase 4: Post-Stress Memory Footprint..." -ForegroundColor Cyan
adb -s $serial shell dumpsys meminfo com.auroraplayer.app | Select-String -Pattern "TOTAL PSS|Native Heap|Dalvik Heap"
