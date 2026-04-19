@echo off
:: run-android.bat
:: All-in-one Windows dev launcher for the Limitter app.
::
:: Key fixes for Windows:
::   - Uses port 8082 (port 8081 is taken by Oracle TNS Listener on this machine)
::   - Sets REACT_NATIVE_PACKAGER_HOSTNAME=localhost so the device connects via
::     the USB cable (adb reverse tunnel) instead of WiFi LAN IP.
::     This means NO firewall rules are needed at all.
::
:: Usage: Double-click this file (no admin or manual steps needed)

setlocal enabledelayedexpansion

:: ── Metro port (change if 8082 is also taken) ─────────────────────────────────
set METRO_PORT=8082

:: ── Force Expo to advertise localhost instead of LAN IP ───────────────────────
:: This makes the device connect via USB tunnel (adb reverse) — no firewall needed.
set REACT_NATIVE_PACKAGER_HOSTNAME=localhost

cd /d "%~dp0"

echo.
echo ============================================================
echo   Limitter  --  Android Dev Launcher  (Windows)
echo   Metro port: %METRO_PORT%  /  Host: localhost (USB tunnel)
echo ============================================================
echo.

:: ── Step 1: Kill any stale Metro on the target port ───────────────────────────
echo [1/4] Clearing port %METRO_PORT%...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%METRO_PORT% "') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo        Done.
echo.

:: ── Step 2: Wait for ADB device ───────────────────────────────────────────────
echo [2/4] Waiting for Android device...
echo        Make sure your phone is connected via USB with USB Debugging enabled.
echo.

set DEVICE_FOUND=0
set /a TRIES=0

:wait_for_device
set /a TRIES+=1
for /f "tokens=*" %%d in ('adb devices 2^>nul ^| findstr /r /c:"device$"') do (
    set DEVICE_FOUND=1
)

if !DEVICE_FOUND! EQU 1 (
    echo        Device detected.
    goto :adb_reverse
)

if !TRIES! GEQ 6 (
    echo.
    echo   ERROR: No Android device found after 30 seconds.
    echo          - Connect your phone via USB
    echo          - Enable USB Debugging  (Settings ^> Developer Options^)
    echo          - Accept the "Allow USB Debugging" prompt on your phone
    echo          - Then re-run this script
    echo.
    pause
    exit /b 1
)

echo        Not found yet, retrying in 5 s... (!TRIES!/6)
timeout /t 5 /nobreak >nul
goto :wait_for_device

:: ── Step 3: ADB reverse tunnel ────────────────────────────────────────────────
:adb_reverse
echo.
echo [3/4] Setting up ADB reverse tunnel (device:localhost:%METRO_PORT% -^> PC:%METRO_PORT%)...
echo.

adb reverse tcp:%METRO_PORT% tcp:%METRO_PORT%
if %errorLevel% EQU 0 (
    echo        OK  adb reverse tcp:%METRO_PORT% tcp:%METRO_PORT%
) else (
    echo        WARN: adb reverse failed. Check USB Debugging is enabled.
    pause
    exit /b 1
)

:: ── Step 4: Build and launch ──────────────────────────────────────────────────
echo.
echo [4/4] Building and launching app on device...
echo        This may take a few minutes on the first run.
echo.
echo ============================================================
echo.

call npx expo run:android --port %METRO_PORT%

echo.
echo ============================================================
if %errorLevel% EQU 0 (
    echo   Build complete. The app should now be open on your device.
) else (
    echo   Build failed. Check the output above for details.
    echo   Common fixes:
    echo     - Run:  npx expo prebuild --clean then re-run this script
    echo     - Make sure Java 17 is installed:  java -version
    echo     - Make sure ANDROID_HOME is set in Environment Variables
)
echo ============================================================
echo.
pause
exit /b
