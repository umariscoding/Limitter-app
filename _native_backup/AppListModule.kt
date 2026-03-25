package com.appguard2

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

class AppListModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AppListModule"
    }

    /**
     * Fetches all installed apps on the device
     * Returns an array of apps with appName and packageName properties
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val mainIntent = Intent(Intent.ACTION_MAIN, null)
            mainIntent.addCategory(Intent.CATEGORY_LAUNCHER)
            
            val resolveInfos = pm.queryIntentActivities(mainIntent, 0)
            val appList: WritableArray = Arguments.createArray()
            val seenPackages = HashSet<String>()

            for (info in resolveInfos) {
                val packageName = info.activityInfo.packageName
                
                // Skip our own app and duplicates
                if (packageName == reactApplicationContext.packageName) continue
                if (seenPackages.contains(packageName)) continue
                
                val appMap: WritableMap = Arguments.createMap()
                val appLabel = info.loadLabel(pm).toString()
                
                // Use the property names expected by TypeScript: appName and packageName
                appMap.putString("appName", appLabel)
                appMap.putString("packageName", packageName)
                
                appList.pushMap(appMap)
                seenPackages.add(packageName)
            }
            
            Log.d("AppListModule", "✅ Found ${appList.size()} installed apps")
            promise.resolve(appList)
        } catch (e: Exception) {
            Log.e("AppListModule", "❌ Error fetching apps: ${e.message}")
            promise.reject("ERROR_FETCH_APPS", e.message)
        }
    }
}
