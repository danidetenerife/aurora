Add-Type -ReferencedAssemblies System.Drawing @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;

public class DesktopLauncher {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    public const uint NORMAL_PRIORITY_CLASS = 0x00000020;
    public const uint CREATE_NEW_PROCESS_GROUP = 0x00000200;

    public static int LaunchOnDefaultDesktop(string exePath, string args, string workingDir) {
        int pid = 0;
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); return; }

            STARTUPINFO si = new STARTUPINFO();
            si.cb = Marshal.SizeOf(si);
            si.lpDesktop = "Default";
            si.dwFlags = 1;
            si.wShowWindow = 1;

            PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
            string cmd = "\"" + exePath + "\" " + args;

            bool ok = CreateProcess(null, cmd, IntPtr.Zero, IntPtr.Zero, false, NORMAL_PRIORITY_CLASS | CREATE_NEW_PROCESS_GROUP, IntPtr.Zero, workingDir, ref si, out pi);
            if (ok) {
                pid = pi.dwProcessId;
            }
            CloseDesktop(hDesk);
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return pid;
    }

    public static void CaptureScreen(string outputPath) {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); return; }
            try {
                int w = GetSystemMetrics(0);
                int h = GetSystemMetrics(1);
                using (Bitmap bmp = new Bitmap(w, h)) {
                    using (Graphics g = Graphics.FromImage(bmp)) {
                        g.CopyFromScreen(0, 0, 0, 0, new Size(w, h));
                    }
                    bmp.Save(outputPath, ImageFormat.Png);
                }
            } catch {}
            CloseDesktop(hDesk);
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }
}
"@

$emuExe = "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
$emuDir = "$env:LOCALAPPDATA\Android\Sdk\emulator"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$apk = "c:\Users\Danid\Desktop\proyectos\aurora\ejecutables\aurora-music-player.apk"
$screenPng = "C:\Users\Danid\.gemini\antigravity\brain\cb61a360-2497-4ddd-b298-26e6a5cb0145\monitor_with_aurora.png"

Write-Host "Iniciando emulador móvil con swiftshader en Default desktop..."
$pid_res = [DesktopLauncher]::LaunchOnDefaultDesktop($emuExe, "-avd Aurora_Mobile -gpu swiftshader -no-snapshot-load", $emuDir)
Write-Host "Emulador lanzado (PID: $pid_res). Esperando conexion ADB..."

& $adb wait-for-device
Write-Host "Dispositivo conectado. Esperando boot_completed..."

for ($i = 0; $i -lt 50; $i++) {
    $res = (& $adb shell getprop sys.boot_completed 2>$null)
    if ($res -and $res.Trim() -eq "1") {
        Write-Host "Boot completed!"
        break
    }
    Start-Sleep -Seconds 2
}

Write-Host "Desbloqueando pantalla..."
& $adb shell input keyevent 82
Start-Sleep -Seconds 1

Write-Host "Instalando APK..."
& $adb install -r -d $apk

Write-Host "Iniciando Aurora..."
& $adb shell am start -n com.auroraplayer.app/.MainActivity
Start-Sleep -Seconds 6

Write-Host "Capturando pantalla del monitor..."
[DesktopLauncher]::CaptureScreen($screenPng)
Write-Host "Captura guardada en: $screenPng"

Write-Host "=== Emulador activo y mantenido abierto indefinidamente ==="
while ($true) {
    Start-Sleep -Seconds 3600
}
