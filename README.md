# Limitter App

React Native app using **Expo (Prebuild / CNG)**.

Native folders (`android/`, `ios/`) are generated locally — not committed.

---

## 📦 Setup

git clone <repo>
cd limitter-app
npm install

Before starting anythihg, delete .expo, node_modules, .android, ios if these folders exist. 

---

## ⚙️ Requirements

- Node.js (use nvm recommended)
- Java **17** -- IMPORTANT
- Android Studio (SDK + Emulator) - SDK Platformn Tools. Build Tools. SDK, Emulator. Make Sure that these packages are installed.

Check Java:
java -version

---

## 🌍 Environment Variables


### macOS / Linux

Add to ~/.zshrc or ~/.bashrc:

export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulatorS
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH

Reload:
source ~/.zshrc

---

### Windows

For windows, open System Settings -> Environment Variables

Set:

ANDROID_HOME = C:\Users\YOUR_USER\AppData\Local\Android\Sdk

Add to PATH:

%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator

---

### Windows — Running on a Physical Device

> **Why is this needed?**
> Windows Defender Firewall blocks the Metro bundler port (8081) by default, and USB-connected
> Android devices require an ADB reverse tunnel so they can reach Metro via the USB cable.
> macOS handles both of these automatically; Windows does not.

**One-time setup + build — just double-click:**

```
run-android.bat
```

That single script will:
1. Detect your connected Android device (waits up to 30 s)
2. Open Windows Firewall for Metro / Expo ports (8081, 8082, 19000–19002)
3. Run `adb reverse tcp:8081 tcp:8081` to create the USB tunnel
4. Run `npx expo run:android` to build, install, and launch the app

> **Note:** The script requires Administrator privileges (it will prompt automatically).
> You must have USB Debugging enabled on your phone.

**Firewall-only setup (standalone):**

If you only want to open the firewall ports without building, run:
```
windows-setup.bat
```

---

## 🚀 Run App
1. npm i --force
2. npm i expo
3. npm i --force

**macOS / Linux** — Start emulator (Android Studio), then:

```
npx expo run:android
```

**Windows** — Connect phone via USB, then double-click `run-android.bat` (see section above).

---

## 🔄 Clean Build (if errors)
rm -rf android node_modules
npm install
npx expo run:android 
---

## 📌 Rules

Do NOT commit:
- android/
- ios/
- android/local.properties

Install packages using:
npx expo install <package>

---

## 🛠 Troubleshooting

SDK issue:
echo $ANDROID_HOME
adb --version

Java issue:
java -version (must be 17)

Devices:
adb devices

**Windows — `SocketTimeoutException: failed to connect to /192.168.x.x`**
Windows Firewall is blocking Metro. Fix: run `windows-setup.bat` as Administrator,
or double-click `run-android.bat` which does this automatically.

**Windows — `Unable to load script` / `adb reverse tcp:8081 tcp:8081`**
The ADB USB tunnel is not set up. Fix: run `adb reverse tcp:8081 tcp:8081` in a terminal
after plugging in your phone, or use `run-android.bat` which does this automatically.

---

## ⚡ Quick Start

npm install
npx expo prebuild --clean
npx expo run:android