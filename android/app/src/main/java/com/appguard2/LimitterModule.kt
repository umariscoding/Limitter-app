package com.appguard2

import android.content.Intent
import android.net.Uri
import android.util.Log
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import android.content.pm.ServiceInfo
import android.widget.Toast
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.ReadableType

import android.app.AppOpsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Process
import android.os.Handler
import android.os.Looper
import java.util.Locale

class LimitterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName(): String {
        return "LimitterModule"
    }

    @ReactMethod
    fun logError(message: String) {
        try {
            val file = java.io.File(reactApplicationContext.getExternalFilesDir(null), "limitter_error.txt")
            file.writeText(message)
        } catch (e: Exception) {
            Log.e("LimitterModule", "Failed to write log", e)
        }
    }

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
                if (packageName == reactApplicationContext.packageName) continue
                if (seenPackages.contains(packageName)) continue
                
                val appMap: WritableMap = Arguments.createMap()
                val appLabel = info.loadLabel(pm).toString()
                
                appMap.putString("name", appLabel)
                appMap.putString("package", packageName)
                appList.pushMap(appMap)
                seenPackages.add(packageName)
            }
            Log.d("LimitterModule", "Found ${appList.size()} apps via queryIntentActivities")
            promise.resolve(appList)
        } catch (e: Exception) {
            Log.e("LimitterModule", "Error fetching apps: ${e.message}")
            promise.reject("ERROR_APPS", e.message)
        }
    }

    @ReactMethod
    fun onAppSelected(packageName: String, promise: Promise) {
        try {
            val appName = resolveAppName(packageName)
            showToast("$appName Selected")
            promise.resolve(appName)
        } catch (e: Exception) {
            promise.reject("ERROR_APP_SELECT", e.message)
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val context = reactApplicationContext
        val overlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true
        val usage = hasUsageStatsPermission()
        val batteryOptimized = isBatteryOptimizationEnabled()
        val exactAlarm = canScheduleExactAlarms()
        
        val map = Arguments.createMap()
        map.putBoolean("overlay", overlay)
        map.putBoolean("usage", usage)
        map.putBoolean("batteryOptimized", batteryOptimized)
        map.putBoolean("exactAlarm", exactAlarm)
        promise.resolve(map)
    }

    private fun canScheduleExactAlarms(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            return alarmManager.canScheduleExactAlarms()
        }
        return true
    }

    private fun isBatteryOptimizationEnabled(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            return !pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)
        }
        return false
    }

    @ReactMethod
    fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${reactApplicationContext.packageName}"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        // Kept for backwards compatibility
        checkAndRequestPermissions(promise)
    }

    @ReactMethod
    fun checkAndRequestPermissions(promise: Promise) {
        val context = reactApplicationContext
        val checkContext = reactApplicationContext.currentActivity ?: context
        var allGranted = true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(checkContext)) {
                allGranted = false
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            }
            if (!hasUsageStatsPermission()) {
                allGranted = false
                val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            }
        }
        promise.resolve(allGranted)
    }

    @ReactMethod
    fun getActiveTimers(promise: Promise) {
        try {
            val timers = LimitterService.getActiveTimers()
            val result = Arguments.createArray()
            
            timers.forEach { (pkg, timer) ->
                val map = Arguments.createMap()
                map.putString("package", pkg)
                map.putString("name", timer.appName)
                val remaining = ((timer.endTimeMillis - System.currentTimeMillis()) / 1000).toInt().coerceAtLeast(0)
                map.putInt("remainingSeconds", remaining)
                map.putString("status", if (timer.isBlocked) "blocked" else "active")
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR_GET_TIMERS", e.message)
        }
    }

    @ReactMethod
    fun showNotification(message: String, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, LimitterService::class.java).apply {
                putExtra("command", "NOTIFICATION")
                putExtra("message", message)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_NOTIF", e.message)
        }
    }

    @ReactMethod
    fun sendCommand(command: String, payload: ReadableMap?, promise: Promise) {
        val context = reactApplicationContext
        try {
            if (command == "START_TIMERS" || command == "START" || command == "OVERRIDE") {
                val checkContext = reactApplicationContext.currentActivity ?: context
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (!Settings.canDrawOverlays(checkContext)) {
                        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(intent)
                        promise.resolve("PERMISSION_OVERLAY_REQUIRED")
                        return
                    }
                    if (!hasUsageStatsPermission()) {
                        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(intent)
                        promise.resolve("PERMISSION_USAGE_REQUIRED")
                        return
                    }
                }
            }

            when (command) {
                "START_TIMERS" -> {
                    // Handle multiple selected apps (DURATION TIMER ONLY)
                    @Suppress("UNCHECKED_CAST")
                    val apps = payload?.getArray("apps")?.let { array ->
                        val list = ArrayList<HashMap<String, String>>()
                        for (i in 0 until array.size()) {
                            val app = array.getMap(i) ?: continue
                            val pkg = app.getString("package") ?: continue
                            val name = app.getString("appName") ?: pkg
                            val durationStr = app.getString("duration") ?: "60"
                            val duration = durationStr.toIntOrNull() ?: 60
                            
                            list.add(hashMapOf(
                                "package" to pkg,
                                "appName" to name,
                                "duration" to duration.toString()
                            ))
                        }
                        list
                    } ?: emptyList()

                    val intent = Intent(context, LimitterService::class.java).apply {
                        putExtra("command", "START_TIMERS")
                        putExtra("apps", ArrayList(apps))
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(intent)
                    } else {
                        context.startService(intent)
                    }
                    
                    Log.d("LimitterModule", "Started timers for ${apps.size} apps")
                    promise.resolve("TIMERS_STARTED")
                }

                else -> {
                    // Original single-app handler
                    val normalizedPayload = HashMap<String, String>()
                    if (payload != null) {
                        val iterator = payload.keySetIterator()
                        while (iterator.hasNextKey()) {
                            val key = iterator.nextKey()
                            normalizedPayload[key] = when (payload.getType(key)) {
                                ReadableType.String -> payload.getString(key) ?: ""
                                ReadableType.Number -> payload.getDouble(key).toInt().toString()
                                ReadableType.Boolean -> payload.getBoolean(key).toString()
                                else -> ""
                            }
                        }
                    }

                    if (command == "START" || command == "OVERRIDE") {
                        val durationSeconds = convertToSeconds(payload)
                        normalizedPayload["duration"] = durationSeconds.toString()

                        val selectedPackage = normalizedPayload["package"].orEmpty()
                        if (selectedPackage.isNotBlank() && normalizedPayload["appName"].isNullOrBlank()) {
                            normalizedPayload["appName"] = resolveAppName(selectedPackage)
                        }
                    }

                    val intent = Intent(context, LimitterService::class.java).apply {
                        putExtra("command", command)
                        if (normalizedPayload.isNotEmpty()) {
                            putExtra("payload", normalizedPayload)
                        }
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        Log.d("LimitterModule", "Starting foreground service with command: $command")
                        context.startForegroundService(intent)
                    } else {
                        context.startService(intent)
                    }
                    promise.resolve("COMMAND_SENT")
                }
            }
        } catch (e: Exception) {
            Log.e("LimitterModule", "Command execution failed: ${e.message}")
            Toast.makeText(context, "Start Failed: ${e.message}", Toast.LENGTH_LONG).show()
            promise.reject("ERROR_COMMAND", "Failed to execute command: ${e.message}")
        }
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun convertToSeconds(payload: ReadableMap?): Int {
        if (payload == null) return 60

        val rawDuration = when {
            payload.hasKey("duration") -> getIntLikeValue(payload, "duration")
            payload.hasKey("timeValue") -> getIntLikeValue(payload, "timeValue")
            payload.hasKey("value") -> getIntLikeValue(payload, "value")
            else -> 60
        }

        val unit = when {
            payload.hasKey("timeUnit") -> payload.getString("timeUnit")
            payload.hasKey("unit") -> payload.getString("unit")
            else -> "seconds"
        }?.lowercase(Locale.US) ?: "seconds"

        val safeDuration = if (rawDuration > 0) rawDuration else 60
        return when (unit) {
            "h", "hr", "hrs", "hour", "hours" -> safeDuration * 3600
            "m", "min", "mins", "minute", "minutes" -> safeDuration * 60
            else -> safeDuration
        }
    }

    private fun getIntLikeValue(map: ReadableMap, key: String): Int {
        return when (map.getType(key)) {
            ReadableType.Number -> map.getDouble(key).toInt()
            ReadableType.String -> map.getString(key)?.toIntOrNull() ?: 0
            else -> 0
        }
    }

    private fun resolveAppName(packageName: String): String {
        return try {
            val pm = reactApplicationContext.packageManager
            val info = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(info).toString()
        } catch (_: Exception) {
            packageName
        }
    }

    private fun showToast(message: String) {
        mainHandler.post {
            Toast.makeText(reactApplicationContext, message, Toast.LENGTH_SHORT).show()
        }
    }

    // ========== CLOCK TIMER (COMPLETELY SEPARATE FROM DURATION TIMER) ==========
    @ReactMethod
    fun startClockTimer(payload: ReadableMap, promise: Promise) {
        val context = reactApplicationContext
        try {
            // Check permissions first
            val checkContext = reactApplicationContext.currentActivity ?: context
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(checkContext)) {
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    promise.resolve("PERMISSION_OVERLAY_REQUIRED")
                    return
                }
                if (!hasUsageStatsPermission()) {
                    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    promise.resolve("PERMISSION_USAGE_REQUIRED")
                    return
                }
            }

            val appsArray = payload.getArray("apps")
            if (appsArray == null) {
                promise.reject("CLOCK_ERROR", "No apps provided")
                return
            }

            val apps = ArrayList<HashMap<String, String>>()
            for (i in 0 until appsArray.size()) {
                val app = appsArray.getMap(i) ?: continue
                val pkg = app.getString("package") ?: continue
                val name = app.getString("appName") ?: pkg
                val hour = getIntLikeValue(app, "hour")
                val minute = getIntLikeValue(app, "minute")

                apps.add(hashMapOf(
                    "package" to pkg,
                    "appName" to name,
                    "hour" to hour.toString(),
                    "minute" to minute.toString()
                ))
            }

            val intent = Intent(context, LimitterService::class.java).apply {
                putExtra("command", "START_CLOCK_TIMER")
                putExtra("apps", apps)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }

            Log.d("LimitterModule", "Started clock timers for ${apps.size} apps")
            promise.resolve("CLOCK_TIMERS_STARTED")
        } catch (e: Exception) {
            Log.e("LimitterModule", "Clock timer failed: ${e.message}")
            promise.reject("CLOCK_ERROR", e.message)
        }
    }
}
