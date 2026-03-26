# Limitter App

React Native app using **Expo (Prebuild / CNG)**.

Native folders (`android/`, `ios/`) are generated locally — not committed.

---

## 📦 Setup

git clone <repo>
cd limitter-app
npm install

---

## ⚙️ Requirements

- Node.js (use nvm recommended)
- Java **17** -- IMPORTANT
- Android Studio (SDK + Emulator)

Check Java:
java -version

---

## 🌍 Environment Variables

### macOS / Linux

Add to ~/.zshrc or ~/.bashrc:

export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH

Reload:
source ~/.zshrc

---

### Windows

Set:

ANDROID_HOME = C:\Users\YOUR_USER\AppData\Local\Android\Sdk

Add to PATH:

%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator

---

## 🚀 Run App
1. npm i --force 
2. npm i expo 
3. npm i --force

Start emulator (Android Studio), then:

npx expo run:android

---

## 🔄 Clean Build (if errors)

rm -rf android node_modules
npm install
npx expo prebuild --clean
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

---

## ⚡ Quick Start

npm install
npx expo prebuild --clean
npx expo run:android