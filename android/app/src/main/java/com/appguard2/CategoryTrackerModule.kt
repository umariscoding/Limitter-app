package com.appguard2

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CategoryTrackerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "CategoryTrackerModule"
    private var receiver: BroadcastReceiver? = null

    override fun getName(): String {
        return "CategoryTrackerModule"
    }

    @ReactMethod
    fun startTracking() {
        if (receiver != null) return
        
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != "com.appguard2.CATEGORY_TRACKER_CHANGE") return
                
                val packageName = intent.getStringExtra("package") ?: ""
                val url = intent.getStringExtra("url") ?: ""
                
                val params = Arguments.createMap().apply {
                    putString("packageName", packageName)
                    putString("url", url)
                }
                
                try {
                    reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onForegroundChange", params)
                } catch (e: Exception) {
                    Log.e(TAG, "emit error: ${e.message}")
                }
            }
        }
        
        val filter = IntentFilter("com.appguard2.CATEGORY_TRACKER_CHANGE")
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            reactContext.registerReceiver(receiver, filter)
        }
    }

    @ReactMethod
    fun stopTracking() {
        receiver?.let {
            reactContext.unregisterReceiver(it)
            receiver = null
        }
    }

    @ReactMethod
    fun triggerBlock(type: String) {
        // Run on UI thread
        reactContext.currentActivity?.let { activity ->
            activity.runOnUiThread {
                val intent = Intent(reactContext, WebsiteBlockerOverlayActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                reactContext.startActivity(intent)
            }
        } ?: run {
            // Fallback: start directly from context
            val intent = Intent(reactContext, WebsiteBlockerOverlayActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            reactContext.startActivity(intent)
        }
        
        // Also force close the current app (go home)
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(homeIntent)
    }

    override fun onCatalystInstanceDestroy() {
        stopTracking()
    }
}
