package com.limitter.app

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log
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
            map.putBoolean("usage", PermissionChecker.hasUsageStats(reactContext))
            map.putBoolean("overlay", PermissionChecker.hasOverlay(reactContext))
            map.putBoolean("batteryOptimized", PermissionChecker.isBatteryOptimized(reactContext))
            map.putBoolean("accessibility", PermissionChecker.hasAccessibility(reactContext))
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
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
        openSystemSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${reactContext.packageName}"), promise)
    }

    @ReactMethod
    fun requestBatteryOptimizationExemption(promise: Promise) {
        openSystemSettings(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${reactContext.packageName}"), promise)
    }

    @ReactMethod
    fun openApplicationDetailsSettings(promise: Promise) {
        openSystemSettings(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${reactContext.packageName}"), promise)
    }

    @ReactMethod
    fun sendCommand(command: String, params: ReadableMap, promise: Promise) {
        try {
            if (!PermissionChecker.hasUsageStats(reactContext)) {
                promise.resolve("PERMISSION_USAGE_REQUIRED")
                return
            }
            if (!PermissionChecker.hasOverlay(reactContext)) {
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
                        obj.put("usedSeconds", app.getString("usedSeconds") ?: "0")
                        jsonArray.put(obj)
                    }

                    val intent = Intent(reactContext, LimitterForegroundService::class.java).apply {
                        action = LimitterForegroundService.ACTION_START_TIMERS
                        putExtra(LimitterForegroundService.EXTRA_APPS_JSON, jsonArray.toString())
                    }
                    ContextCompat.startForegroundService(reactContext, intent)
                    promise.resolve("OK")
                }
                "START_WEBSITE_TIMERS" -> {
                    val websitesArray = params.getArray("websites") ?: run {
                        promise.resolve("OK")
                        return
                    }

                    val jsonArray = JSONArray()
                    for (i in 0 until websitesArray.size()) {
                        val site = websitesArray.getMap(i) ?: continue
                        val obj = JSONObject()
                        obj.put("domain", site.getString("domain") ?: "")
                        obj.put("duration", site.getString("duration") ?: "0")
                        obj.put("usedSeconds", site.getString("usedSeconds") ?: "0")
                        jsonArray.put(obj)
                    }

                    val intent = Intent(reactContext, LimitterForegroundService::class.java).apply {
                        action = LimitterForegroundService.ACTION_START_WEBSITE_TIMERS
                        putExtra(LimitterForegroundService.EXTRA_WEBSITES_JSON, jsonArray.toString())
                    }
                    ContextCompat.startForegroundService(reactContext, intent)
                    promise.resolve("OK")
                }
                "BLOCK_APP" -> {
                    val pkg = params.getString("package") ?: ""
                    if (pkg.isNotEmpty()) {
                        TimerStateManager.markBlocked(pkg)
                        // Also flip timer.status to "blocked" so the poll loop catches it.
                        // markBlocked only updates blockedPackages (a dead set); the actual
                        // blocking decision in pollForegroundApp reads timer.status.
                        val timer = TimerStateManager.activeTimers[pkg]
                        if (timer != null && timer.status != "blocked") {
                            TimerStateManager.activeTimers[pkg] = timer.copy(
                                usedSeconds = timer.durationSeconds,
                                status = "blocked",
                                lastActiveTimestamp = 0
                            )
                        }
                    }
                    promise.resolve("OK")
                }
                "UNBLOCK_APP" -> {
                    val pkg = params.getString("package") ?: ""
                    if (pkg.isNotEmpty()) {
                        TimerStateManager.blockedPackages.remove(pkg)
                        val timer = TimerStateManager.activeTimers[pkg]
                        if (timer != null && timer.status == "blocked") {
                            TimerStateManager.activeTimers[pkg] = timer.copy(
                                usedSeconds = 0,
                                status = "waiting",
                                lastActiveTimestamp = 0
                            )
                            TimerStateManager.persistToPrefs(reactContext)
                        }
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
    fun openAccessibilitySettings(promise: Promise) {
        openSystemSettings(Settings.ACTION_ACCESSIBILITY_SETTINGS, null, promise)
    }

    @ReactMethod
    fun startWebsiteTimer(params: ReadableMap, promise: Promise) {
        try {
            if (!PermissionChecker.hasOverlay(reactContext)) {
                promise.resolve("PERMISSION_OVERLAY_REQUIRED")
                return
            }
            if (!PermissionChecker.hasAccessibility(reactContext)) {
                promise.resolve("PERMISSION_ACCESSIBILITY_REQUIRED")
                return
            }

            val websiteUrl = params.getString("websiteUrl") ?: ""
            val domain = WebsiteDomainMatcher.extractDomain(websiteUrl)
            if (domain.isNullOrEmpty()) {
                promise.resolve("INVALID_URL")
                return
            }

            val durationSeconds: Int
            if (params.hasKey("blockAtTimestampMs")) {
                val targetMs = params.getDouble("blockAtTimestampMs").toLong()
                val nowMs = System.currentTimeMillis()
                durationSeconds = if (targetMs > nowMs) ((targetMs - nowMs) / 1000).toInt() else 0
            } else {
                durationSeconds = params.getInt("durationSeconds")
            }

            if (durationSeconds <= 0) {
                promise.resolve("INVALID_DURATION")
                return
            }

            val jsonArray = JSONArray()
            val obj = JSONObject()
            obj.put("domain", domain)
            obj.put("duration", durationSeconds.toString())
            jsonArray.put(obj)

            val intent = Intent(reactContext, LimitterForegroundService::class.java).apply {
                action = LimitterForegroundService.ACTION_START_WEBSITE_TIMERS
                putExtra(LimitterForegroundService.EXTRA_WEBSITES_JSON, jsonArray.toString())
            }
            ContextCompat.startForegroundService(reactContext, intent)
            promise.resolve("OK")
        } catch (e: Exception) {
            promise.reject("WEBSITE_TIMER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getActiveTimers(promise: Promise) {
        try {
            // Do NOT gate on LimitterForegroundService.isRunning(). The service can be killed
            // by Android (memory / battery optimization) while the JS process stays alive, and
            // TimerStateManager.activeTimers is a process-wide singleton that still holds the
            // correct blocked/active state. If the whole process was restarted and the service
            // hasn't been re-created yet, lazy-restore from SharedPreferences so the dashboard
            // refresh reflects the persisted state.
            if (TimerStateManager.activeTimers.isEmpty()) {
                TimerStateManager.loadFromPrefs(reactContext)
            }

            val now = System.currentTimeMillis()
            val result = WritableNativeArray()
            for ((pkg, timer) in TimerStateManager.activeTimers) {
                val map = WritableNativeMap()
                map.putString("package", pkg)
                map.putString("name", timer.appName)
                // Factor in the currently-running session so remainingSeconds reflects
                // real-time usage. Matches the math used by NotificationHelper.
                val liveSessionSeconds = if (timer.status == "active" && timer.lastActiveTimestamp > 0) {
                    maxOf(0, ((now - timer.lastActiveTimestamp) / 1000).toInt())
                } else {
                    0
                }
                val remaining = maxOf(0, timer.durationSeconds - timer.usedSeconds - liveSessionSeconds)
                map.putInt("remainingSeconds", remaining)
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
        map.putBoolean("overlayEnabled", PermissionChecker.hasOverlay(reactContext))
        map.putBoolean("accessibilityEnabled", PermissionChecker.hasAccessibility(reactContext))
        map.putBoolean("ready", PermissionChecker.hasOverlay(reactContext) && PermissionChecker.hasAccessibility(reactContext))
        promise.resolve(map)
    }
}
