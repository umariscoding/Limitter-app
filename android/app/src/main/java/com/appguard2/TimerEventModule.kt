package com.appguard2

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class TimerEventModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val TAG = "TimerEventModule"
    private var receiver: BroadcastReceiver? = null

    override fun getName() = "TimerEventModule"

    @ReactMethod
    fun startListening() {
        if (receiver != null) return
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != "com.appguard2.TIMER_TICK") return
                val packageName = intent.getStringExtra("package") ?: ""
                val appName = intent.getStringExtra("appName") ?: ""
                val remaining = intent.getIntExtra("remaining", 0)
                val isBlocked = intent.getBooleanExtra("isBlocked", false)

                val params = com.facebook.react.bridge.Arguments.createMap().apply {
                    putString("package", packageName)
                    putString("appName", appName)
                    putInt("remaining", remaining)
                    putBoolean("isBlocked", isBlocked)
                }
                try {
                    reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("TIMER_TICK", params)
                } catch (e: Exception) {
                    Log.e(TAG, "emit error: ${e.message}")
                }
            }
        }

        val filter = IntentFilter("com.appguard2.TIMER_TICK")
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(receiver, filter)
        }
        Log.d(TAG, "BroadcastReceiver registered")
    }

    @ReactMethod
    fun stopListening() {
        receiver?.let {
            try { reactContext.unregisterReceiver(it) } catch (_: Exception) {}
            receiver = null
        }
    }

    override fun onCatalystInstanceDestroy() {
        stopListening()
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built in Event Emitter Calls.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built in Event Emitter Calls.
    }
}