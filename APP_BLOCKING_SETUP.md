# 🚀 App Blocking Implementation Guide

## اب تک کیا ہوا (What's Done)

✅ **Frontend Services Prepared:**
- `appListService.ts` - Installed apps fetching
- `appBlockerService.ts` - Foreground app monitoring + blocking
- Dashboard modal updated to load real apps

---

## ⚠️ اب کیا چاہیے (What's Missing)

Android میں apps block کرنے کے لیے **3 چیزیں ضروری** ہیں:

### 1️⃣ **Native Module for App List** 
```bash
npm install react-native-installed-apps
```

**یہ کرے گا:**
- Phone کے installed apps کی list دے
- ہر app کا packageName اور appName دے

---

### 2️⃣ **Native Module for Foreground App Detection**
```bash
npm install react-native-detect-foreground-app
```

**یہ کرے گا:**
- ہر وقت جانیں کون سی app user نے open کی ہے
- Events بھیجے جب app بدلے

---

### 3️⃣ **Android Accessibility Service + Blocking Overlay**

#### Step A: Android Project میں native files add کریں

**File:** `android/app/src/main/java/com/appguard2/AppBlockerService.java`

```java
package com.appguard2;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;
import android.app.AppOpsManager;
import android.content.pm.ApplicationInfo;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.view.Gravity;

public class AppBlockerService extends AccessibilityService {

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Detect when app is opened
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            String packageName = event.getPackageName().toString();
            
            // Check if blocked in RN bridge
            AppBlockerBridge.checkAndBlockApp(packageName);
        }
    }

    @Override
    public void onInterrupt() {}

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        this.setServiceInfo(info);
    }
}
```

#### Step B: Native Bridge بنائیں

**File:** `android/app/src/main/java/com/appguard2/AppBlockerBridge.java`

```java
package com.appguard2;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.app.AppOpsManager;
import android.content.Context;

public class AppBlockerBridge extends ReactContextBaseJavaModule {

    private static ReactApplicationContext mContext;
    private static boolean isMonitoring = false;

    public AppBlockerBridge(ReactApplicationContext context) {
        super(context);
        mContext = context;
    }

    @Override
    public String getName() {
        return "AppBlockerModule";
    }

    @ReactMethod
    public void startMonitoring(Promise promise) {
        try {
            isMonitoring = true;
            promise.resolve(new ReactMap().pushString("success", "true"));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopMonitoring(Promise promise) {
        try {
            isMonitoring = false;
            promise.resolve(new ReactMap().pushString("success", "true"));
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void showBlockingOverlay(ReadableMap options, Promise promise) {
        try {
            String appName = options.getString("appName");
            String message = options.getString("message");
            
            // Show overlay blocking the app
            // Implementation depends on your UI framework
            
            promise.resolve("Overlay shown");
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    public static void checkAndBlockApp(String packageName) {
        if (!isMonitoring) return;
        
        // Emit event to React Native
        mContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onForegroundAppChanged", new ReactMap()
                .pushString("packageName", packageName)
                .pushString("appName", packageName));
    }
}
```

#### Step C: AndroidManifest.xml میں Accessibility Service register کریں

**File:** `android/app/src/main/AndroidManifest.xml`

```xml
<manifest>
    <!-- Add Accessibility permissions -->
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    <uses-permission android:name="android.permission.GET_INSTALLED_APPS" />
    
    <application>
        <!-- ... existing code ... -->
        
        <!-- Add Accessibility Service -->
        <service
            android:name="com.appguard2.AppBlockerService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_config" />
        </service>
    </application>
</manifest>
```

#### Step D: Accessibility Configuration

**File:** `android/app/src/main/res/xml/accessibility_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/service_description"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100" />
```

---

## 📋 Implementation Order

```
1. npm install react-native-installed-apps
2. npm install react-native-detect-foreground-app  
3. cd android && ./gradlew linkDebugPackageForARelease (link native modules)
4. Add AppBlockerService.java
5. Add AppBlockerBridge.java
6. Update AndroidManifest.xml
7. Add accessibility_config.xml
8. npx react-native run-android
```

---

## 🧪 Testing Flow

```
STEP 1: Open app, login
↓
STEP 2: Create limit for "Instagram"
- Modal shows list of installed apps
- User selects Instagram
- Time limit: 2 minutes
↓
STEP 3: Dashboard shows Instagram (0/2 min, ACTIVE)
↓
STEP 4: Click "Simulate +5 min" twice
- Instagram shows 10/2 min, BLOCKED (red)
↓
STEP 5: User tries to open Instagram
- AppBlocker detects package open
- Shows overlay: "App is blocked. 10 min / 2 min used"
- Instagram doesn't open ✅
↓
STEP 6: Click "Use Override" on dashboard
- Override screen appears
- Confirm override
- overrides_left decrements in dashboard
- Block removed, Instagram opens normally ✅
```

---

## 🔧 Without Native Modules (POC Alternative)

اگر native modules install نہیں کر سکتے تو:

1. **Hardcoded app list** `appSuggestions` میں (جو پہلے تھا)
2. **Fake foreground app events** backend سے
3. **Overlay overlay** React Native modal سے

لیکن **real blocking** نہیں ہوگی۔

---

## ⚡ Quick Start (Native Setup)

```bash
# In your project root:
cd android

# Link packages
./gradlew linkDebugPackageForARelease

# Add files mentioned above

# Build
cd ..
npx react-native run-android
```

---

## 📚 Package Documentation

- **react-native-installed-apps**: https://github.com/IntelliConnect/react-native-installed-apps
- **react-native-detect-foreground-app**: https://github.com/marceluphd/react-native-detect-foreground-app

---

## ✅ یہ مکمل ہونے سے پہلے کیا test کریں

1. **App List Loading** - Modal میں apps آ جائیں
2. **App Selection** - Select کرنے سے app name save ہو
3. **Timer Working** - H:M:S correctly calculate ہو
4. **Limits Display** - Dashboard میں دکھائیں
5. **Override Flow** - Context میں overrides_left کم ہو

---

**اگلا step: کون سے files آپ add کر سکتے ہو آج؟**
