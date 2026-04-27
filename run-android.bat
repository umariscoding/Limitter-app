@echo off
:: run-android.bat
:: All-in-one Windows dev launcher for the Limitter app.
::
:: Key fixes for Windows:
::   - Uses port 8082 (port 8081 is taken by Oracle TNS Listener on this machine)
::   - Sets REACT_NATIVE_PACKAGER_HOSTNAME=localhost so the device connects via
::     the USB cable (adb reverse tunnel) instead of WiFi LAN IP.
::     This means NO firewall rules are needed at all.
::   - Pins ADB to the SDK binary so this script AND Expo use the same adb.
::     Mismatched adb versions on PATH (BlueStacks, MEmu, vendor PC suites,
::     scrcpy, Vysor, Genymotion) crash the server with exit code 4294967295.
::   - Streams build output to console and _build.log simultaneously.
::
:: Usage: Double-click this file (no admin or manual steps needed)

setlocal enabledelayedexpansion

:: -- Metro port (change if 8082 is also taken) --------------------------------
set METRO_PORT=8082

:: -- Force Expo to advertise localhost instead of LAN IP ----------------------
:: Makes the device connect via USB tunnel (adb reverse) - no firewall needed.
set REACT_NATIVE_PACKAGER_HOSTNAME=localhost

:: -- Pin ADB / Android SDK so script and Expo use the SAME adb binary ---------
if "%ANDROID_HOME%"=="" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ADB=%ANDROID_HOME%\platform-tools\adb.exe"
set "PATH=%ANDROID_HOME%\platform-tools;%PATH%"

cd /d "%~dp0"

echo.
echo ============================================================
echo   Limitter  --  Android Dev Launcher  (Windows)
echo   Metro port: %METRO_PORT%  /  Host: localhost (USB tunnel)
echo   ADB:        %ADB%
echo ============================================================
echo.

if not exist "%ADB%" (
    echo   ERROR: adb.exe not found at:
    echo          %ADB%
    echo          Install Android SDK Platform-Tools or set ANDROID_HOME.
    echo.
    pause
    exit /b 1
)

:: -- Step 1: Kill any stale Metro on the target port --------------------------
echo [1/5] Clearing port %METRO_PORT%...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%METRO_PORT% "') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo        Done.
echo.

:: -- Step 2: Reset ADB server (clear version conflicts) -----------------------
echo [2/5] Resetting ADB server...
"%ADB%" kill-server >nul 2>&1
taskkill /F /IM adb.exe >nul 2>&1
echo        Starting fresh ADB server (output below)...
echo        ----------------------------------------------------------------
"%ADB%" start-server
set ADB_RC=!errorLevel!
echo        ----------------------------------------------------------------
if !ADB_RC! NEQ 0 goto :adb_failed
echo        Done.
echo.

:: -- Step 3: Wait for ADB device ---------------------------------------------
echo [3/5] Waiting for Android device...
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

:: -- Step 4: ADB reverse tunnel ----------------------------------------------
:adb_reverse
echo.
echo [4/5] Setting up ADB reverse tunnel (device:localhost:%METRO_PORT% -^> PC:%METRO_PORT%)...
echo.

"%ADB%" reverse tcp:%METRO_PORT% tcp:%METRO_PORT%
if !errorLevel! EQU 0 (
    echo        OK  adb reverse tcp:%METRO_PORT% tcp:%METRO_PORT%
) else (
    echo        WARN: adb reverse failed. Check USB Debugging is enabled.
    pause
    exit /b 1
)

:: -- Step 5: Build and launch -------------------------------------------------
:: NOTE: We intentionally do NOT pipe through tee/Tee-Object here -- both
:: buffer native-command output on Windows and make it look like the build
:: is hung when it is actually running. Live output goes straight to the
:: console; if you need a log next time, run:
::     run-android.bat 2> _build.log     (errors only)
::   or open a new terminal and re-run with explicit logging.
echo.
echo [5/5] Building and launching app on device...
echo        This may take 3-10 minutes on the first run (Gradle download + native build).
echo.
echo ============================================================
echo.

:: Bypass npx (known to silently stall on Windows package-resolution checks).
:: Use the local expo binary from node_modules\.bin directly.
:: CI=1 forces non-interactive mode so expo never blocks waiting for input.
set CI=1
set EXPO_NO_TELEMETRY=1
call ".\node_modules\.bin\expo.cmd" run:android --port %METRO_PORT%
set BUILD_RC=!errorLevel!

echo.
echo ============================================================
if !BUILD_RC! EQU 0 (
    echo   Build complete. The app should now be open on your device.
    echo ============================================================
    echo.
    exit /b 0
)

echo   Build failed (exit code !BUILD_RC!). See _build.log for details.
echo   Common fixes:
echo     - If you see "adb start-server exited with non-zero code":
echo         Close BlueStacks / MEmu / vendor PC suite, then re-run.
echo     - Try:  npx expo prebuild --clean   then re-run this script.
echo     - Make sure Java 17 is installed:   java -version
echo     - ANDROID_HOME is currently:        %ANDROID_HOME%
echo ============================================================
echo.
pause
exit /b !BUILD_RC!

:: -- Failure path: ADB server would not start --------------------------------
:adb_failed
echo.
echo   ERROR: 'adb start-server' failed with exit code !ADB_RC!.
echo.
echo   Most likely cause: another tool is holding TCP port 5037 with a
echo   different adb version. Common offenders:
echo     - BlueStacks / MEmu / LDPlayer / NoxPlayer / MuMu emulators
echo     - Samsung Smart Switch, Xiaomi/Oppo/Vivo PC suites
echo     - Genymotion, Vysor, scrcpy, Unity Hub
echo     - A second Android Studio install with its own platform-tools
echo.
echo   Diagnostic - processes listening on port 5037:
netstat -aon | findstr ":5037 "
echo.
echo   Diagnostic - all running adb.exe processes:
tasklist /FI "IMAGENAME eq adb.exe"
echo.
echo   Next steps:
echo     1. Close the offending app (or stop its background service).
echo     2. Re-run this script.
echo     3. If it still fails, paste the diagnostic output above.
echo.
pause
exit /b 1
