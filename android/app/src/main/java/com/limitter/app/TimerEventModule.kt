package com.limitter.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class TimerEventModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var reactCtx: ReactApplicationContext? = null

        fun sendTickEvent(
            packageName: String,
            appName: String,
            remaining: Int,
            isBlocked: Boolean,
            status: String
        ) {
            val ctx = reactCtx ?: return
            try {
                val map = WritableNativeMap()
                map.putString("package", packageName)
                map.putString("appName", appName)
                map.putInt("remaining", remaining)
                map.putBoolean("isBlocked", isBlocked)
                map.putString("status", status)
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("TIMER_TICK", map)
            } catch (_: Exception) {}
        }

        fun sendBlockedEvent(packageName: String, appName: String) {
            val ctx = reactCtx ?: return
            try {
                val map = WritableNativeMap()
                map.putString("package", packageName)
                map.putString("appName", appName)
                map.putDouble("blockedAt", System.currentTimeMillis().toDouble())
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("TIMER_BLOCKED", map)
            } catch (_: Exception) {}
        }

        fun sendSessionEndEvent(packageName: String, appName: String, sessionSeconds: Int) {
            val ctx = reactCtx ?: return
            try {
                val map = WritableNativeMap()
                map.putString("package", packageName)
                map.putString("appName", appName)
                map.putInt("sessionSeconds", sessionSeconds)
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("TIMER_SESSION_END", map)
            } catch (_: Exception) {}
        }
    }

    override fun getName(): String = "TimerEventModule"

    override fun initialize() {
        super.initialize()
        reactCtx = reactContext
    }

    override fun invalidate() {
        reactCtx = null
        super.invalidate()
    }

    @ReactMethod
    fun startListening() {
        // JS side calls this to indicate it's ready for events
        reactCtx = reactContext
    }

    @ReactMethod
    fun stopListening() {
        // Optional cleanup
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for NativeEventEmitter
    }
}
