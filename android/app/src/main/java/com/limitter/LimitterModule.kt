package com.limitter

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import android.accessibilityservice.AccessibilityServiceInfo
import android.util.Log
import android.view.accessibility.AccessibilityManager
import android.app.usage.UsageStatsManager
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap

class LimitterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LimitterModule"

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            val map = WritableNativeMap()
            map.putBoolean("usage", hasUsageStatsPermission())
            map.putBoolean("overlay", hasOverlayPermission())
            map.putBoolean("batteryOptimized", isBatteryOptimized())
            map.putBoolean("accessibility", hasAccessibilityPermission())
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactContext.packageName
        )
        if (mode == AppOpsManager.MODE_ALLOWED) return true

        try {
            val usm = reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                now - 24 * 60 * 60 * 1000,
                now
            )
            if (stats != null && stats.isNotEmpty()) return true
        } catch (_: Exception) {}

        return false
    }

    private fun hasOverlayPermission(): Boolean {
        return Settings.canDrawOverlays(reactContext)
    }

    private fun isBatteryOptimized(): Boolean {
        val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        return !pm.isIgnoringBatteryOptimizations(reactContext.packageName)
    }

    private fun hasAccessibilityPermission(): Boolean {
        val am = reactContext.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        )
        return enabledServices.any {
            it.resolveInfo?.serviceInfo?.packageName == reactContext.packageName
        }
    }

    private fun openSystemSettings(action: String, data: Uri? = null, promise: Promise) {
        try {
            val intent = Intent(action)
            if (data != null) intent.data = data
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            openSystemSettings(Settings.ACTION_USAGE_ACCESS_SETTINGS, null, promise)
        } catch (e: Exception) {
            openSystemSettings(Settings.ACTION_SETTINGS, null, promise)
        }
    }

    @ReactMethod
    fun openOverlaySettings(promise: Promise) {
        openSystemSettings(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactContext.packageName}"),
            promise
        )
    }

    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        openSystemSettings(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${reactContext.packageName}"),
            promise
        )
    }

    @ReactMethod
    fun openApplicationDetailsSettings(promise: Promise) {
        openSystemSettings(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${reactContext.packageName}"),
            promise
        )
    }

    @ReactMethod
    fun sendCommand(command: String, params: ReadableMap, promise: Promise) {
        try {
            if (!hasUsageStatsPermission()) {
                promise.resolve("PERMISSION_USAGE_REQUIRED")
                return
            }
            if (!hasOverlayPermission()) {
                promise.resolve("PERMISSION_OVERLAY_REQUIRED")
                return
            }

            when (command) {
                "START_TIMERS" -> {
                    val appsArray = params.getArray("apps") ?: run {
                        promise.resolve("OK")
                        return
                    }

                    val jsonArray = JSONArray()
                    for (i in 0 until appsArray.size()) {
                        val app = appsArray.getMap(i) ?: continue
                        val obj = JSONObject()
                        obj.put("package", app.getString("package") ?: "")
                        obj.put("appName", app.getString("appName") ?: "")
                        obj.put("duration", app.getString("duration") ?: "0")
                        jsonArray.put(obj)
                    }

                    val intent = Intent(reactContext, LimitterForegroundService::class.java).apply {
                        action = LimitterForegroundService.ACTION_START_TIMERS
                        putExtra(LimitterForegroundService.EXTRA_APPS_JSON, jsonArray.toString())
                    }
                    ContextCompat.startForegroundService(reactContext, intent)
                    promise.resolve("OK")
                }
                "BLOCK_APP" -> {
                    val pkg = params.getString("package") ?: ""
                    if (pkg.isNotEmpty()) {
                        TimerStateManager.markBlocked(pkg)
                    }
                    promise.resolve("OK")
                }
                "STOP" -> {
                    val intent = Intent(reactContext, LimitterForegroundService::class.java).apply {
                        action = LimitterForegroundService.ACTION_STOP
                    }
                    reactContext.startService(intent)
                    promise.resolve("OK")
                }
                else -> promise.resolve("OK")
            }
        } catch (e: Exception) {
            Log.e("LimitterModule", "sendCommand error", e)
            promise.reject("SEND_COMMAND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startClockTimer(params: ReadableMap, promise: Promise) {
        try {
            val appsArray = params.getArray("apps") ?: run {
                promise.resolve("OK")
                return
            }

            val jsonArray = JSONArray()
            for (i in 0 until appsArray.size()) {
                val app = appsArray.getMap(i) ?: continue
                val hour = app.getInt("hour")
                val minute = app.getInt("minute")

                val now = java.util.Calendar.getInstance()
                val target = java.util.Calendar.getInstance().apply {
                    set(java.util.Calendar.HOUR_OF_DAY, hour)
                    set(java.util.Calendar.MINUTE, minute)
                    set(java.util.Calendar.SECOND, 0)
                }
                if (target.timeInMillis <= now.timeInMillis) {
                    target.add(java.util.Calendar.DAY_OF_MONTH, 1)
                }
                val durationSeconds = ((target.timeInMillis - now.timeInMillis) / 1000).toInt()

                val obj = JSONObject()
                obj.put("package", app.getString("package") ?: "")
                obj.put("appName", app.getString("appName") ?: "")
                obj.put("duration", durationSeconds.toString())
                jsonArray.put(obj)
            }

            val intent = Intent(reactContext, LimitterForegroundService::class.java).apply {
                action = LimitterForegroundService.ACTION_START_TIMERS
                putExtra(LimitterForegroundService.EXTRA_APPS_JSON, jsonArray.toString())
            }
            ContextCompat.startForegroundService(reactContext, intent)
            promise.resolve("OK")
        } catch (e: Exception) {
            promise.reject("CLOCK_TIMER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startWebsiteTimer(params: ReadableMap, promise: Promise) {
        promise.resolve("OK")
    }

    @ReactMethod
    fun getActiveTimers(promise: Promise) {
        try {
            if (!LimitterForegroundService.isRunning()) {
                promise.resolve(WritableNativeArray())
                return
            }

            val result = WritableNativeArray()
            for ((pkg, timer) in TimerStateManager.activeTimers) {
                val map = WritableNativeMap()
                map.putString("package", pkg)
                map.putString("name", timer.appName)
                map.putInt("remainingSeconds", maxOf(0, timer.durationSeconds - timer.usedSeconds))
                map.putInt("liveTimerUsageBudgetSeconds", timer.durationSeconds)
                map.putString("status", timer.status)
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.resolve(WritableNativeArray())
        }
    }

    @ReactMethod
    fun getWebsiteBlockerStatus(promise: Promise) {
        val map = WritableNativeMap()
        map.putBoolean("overlayEnabled", hasOverlayPermission())
        map.putBoolean("accessibilityEnabled", hasAccessibilityPermission())
        map.putBoolean("ready", hasOverlayPermission() && hasAccessibilityPermission())
        promise.resolve(map)
    }
}
