@echo off
:: windows-setup.bat
:: Opens Windows Firewall ports required by Expo / Metro bundler.
:: Run this ONCE as Administrator on any new Windows machine.

:: ── Self-elevate to Administrator ─────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && \"%~f0\"' -Verb RunAs"
    exit /b
)

echo.
echo ============================================================
echo   Expo / Metro  --  Windows Firewall Setup
echo ============================================================
echo.

:: ── Firewall rules ────────────────────────────────────────────────────────────
echo [1/2] Adding Windows Firewall inbound rules for Metro / Expo ports...
echo.

call :add_rule "Expo Metro 8081"    8081
call :add_rule "Expo Metro 8082"    8082
call :add_rule "Expo DevTools 19000" 19000
call :add_rule "Expo DevTools 19001" 19001
call :add_rule "Expo DevTools 19002" 19002

echo.
echo        All firewall rules applied.
echo.

:: ── ADB reverse tunnel ────────────────────────────────────────────────────────
echo [2/2] Setting up ADB reverse tunnel...
echo        (Your phone must be connected via USB with USB Debugging on)
echo.

adb reverse tcp:8081 tcp:8081 >nul 2>&1
if %errorLevel% EQU 0 (
    echo        OK  adb reverse tcp:8081 tcp:8081
) else (
    echo        WARN: adb reverse failed.
    echo              Connect your phone via USB, enable USB Debugging,
    echo              then re-run this script  OR  run:  adb reverse tcp:8081 tcp:8081
)

echo.
echo ============================================================
echo   Setup complete.
echo   You can now run:  npx expo run:android
echo ============================================================
echo.
pause
exit /b

:: ── Helper: add a single firewall rule idempotently ───────────────────────────
:add_rule
netsh advfirewall firewall delete rule name=%1 >nul 2>&1
netsh advfirewall firewall add rule name=%1 dir=in action=allow protocol=TCP localport=%2 >nul 2>&1
echo        OK  port %2  (%~1)
exit /b
