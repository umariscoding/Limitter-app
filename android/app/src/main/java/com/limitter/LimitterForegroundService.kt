package com.limitter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class LimitterForegroundService : Service() {

    companion object {
        const val TAG = "LimitterSvc"
        const val CHANNEL_ID = "limitter_tracking"
        const val NOTIFICATION_ID = 1001
        const val POLL_INTERVAL_MS = 3000L
        const val PREFS_NAME = "limitter_timers"

        const val ACTION_START_TIMERS = "START_TIMERS"
        const val ACTION_STOP = "STOP"
        const val EXTRA_APPS_JSON = "apps_json"

        val activeTimers = mutableMapOf<String, TimerEntry>()
        val blockedPackages = mutableSetOf<String>()

        private var instance: LimitterForegroundService? = null

        fun isRunning(): Boolean = instance != null

        /**
         * Load persisted timers from SharedPreferences (called from LimitterModule
         * even when service is not running).
         */
        fun loadPersistedTimers(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString("timers", null) ?: return
            val today = todayDate()

            try {
                val arr = JSONArray(json)
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    val pkg = obj.getString("pkg")
                    val startDate = obj.optString("startDate", "")

                    // Only restore today's timers
                    if (startDate != today) continue

                    val entry = TimerEntry(
                        packageName = pkg,
                        appName = obj.getString("appName"),
                        durationSeconds = obj.getInt("duration"),
                        usedSeconds = obj.getInt("used"),
                        status = obj.getString("status"),
                        lastActiveTimestamp = 0,
                        startDate = startDate
                    )
                    activeTimers[pkg] = entry
                    if (entry.status == "blocked") {
                        blockedPackages.add(pkg)
                    }
                }
                Log.w(TAG, "Loaded ${activeTimers.size} persisted timers")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to load persisted timers", e)
            }
        }
    }

    data class TimerEntry(
        val packageName: String,
        val appName: String,
        val durationSeconds: Int,
        var usedSeconds: Int = 0,
        var status: String = "waiting",
        var lastActiveTimestamp: Long = 0,
        val startDate: String = todayDate()
    )

    private val handler = Handler(Looper.getMainLooper())
    private var isPolling = false
    private var lastDetectedForeground: String? = null
    private var persistCounter = 0

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (!isPolling) return
            try {
                pollForegroundApp()
            } catch (e: Exception) {
                Log.e(TAG, "Poll error", e)
            }
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        // Restore persisted timers on service create
        if (activeTimers.isEmpty()) {
            loadPersistedTimers(this)
        }
        Log.w(TAG, "Service CREATED, timers=${activeTimers.size}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_STICKY

        when (action) {
            ACTION_START_TIMERS -> {
                val appsJson = intent.getStringExtra(EXTRA_APPS_JSON) ?: "[]"
                parseAndAddTimers(appsJson)
                startForeground(NOTIFICATION_ID, buildNotification())
                startPolling()
                persistTimers()
            }
            ACTION_STOP -> {
                stopPolling()
                activeTimers.clear()
                blockedPackages.clear()
                persistTimers()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        persistTimers()
        stopPolling()
        instance = null
        Log.w(TAG, "Service DESTROYED — timers persisted")
        super.onDestroy()
    }

    private fun parseAndAddTimers(appsJson: String) {
        try {
            val arr = JSONArray(appsJson)
            val today = todayDate()

            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val pkg = obj.getString("package")
                val appName = obj.optString("appName", pkg)
                val duration = obj.optString("duration", "0").toIntOrNull() ?: 0

                if (duration <= 0 || pkg.isEmpty()) continue

                val existing = activeTimers[pkg]
                if (existing != null && existing.startDate == today && existing.durationSeconds == duration) {
                    Log.w(TAG, "KEEP timer: $appName ($pkg) ${duration}s, used=${existing.usedSeconds}s [${existing.status}]")
                } else {
                    activeTimers[pkg] = TimerEntry(
                        packageName = pkg,
                        appName = appName,
                        durationSeconds = duration
                    )
                    blockedPackages.remove(pkg)
                    Log.w(TAG, "NEW timer: $appName ($pkg) ${duration}s")
                }
            }

            Log.w(TAG, "Total active timers: ${activeTimers.size}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse timers JSON", e)
        }
    }

    private fun startPolling() {
        if (isPolling) return
        isPolling = true
        handler.post(pollRunnable)
        Log.w(TAG, "Polling STARTED")
    }

    private fun stopPolling() {
        isPolling = false
        handler.removeCallbacks(pollRunnable)
    }

    private fun pollForegroundApp() {
        val detected = getForegroundPackage()
        // If detection returns null, keep using the last known foreground
        // (the user likely hasn't switched apps — detection just had a gap)
        val foregroundPkg = detected ?: lastDetectedForeground
        val now = System.currentTimeMillis()
        val today = todayDate()

        if (detected != null && detected != lastDetectedForeground) {
            Log.w(TAG, "Foreground: $detected")
            lastDetectedForeground = detected
        }

        if (foregroundPkg == null) return

        for ((pkg, timer) in activeTimers.toMap()) {
            if (timer.startDate != today) {
                activeTimers[pkg] = timer.copy(
                    usedSeconds = 0,
                    status = "waiting",
                    startDate = today
                )
                blockedPackages.remove(pkg)
                continue
            }

            if (pkg == foregroundPkg) {
                if (timer.status == "blocked") {
                    launchBlockOverlay(timer.appName, pkg)
                    continue
                }

                val elapsed = if (timer.lastActiveTimestamp > 0 && timer.status == "active") {
                    ((now - timer.lastActiveTimestamp) / 1000).toInt().coerceIn(0, 15)
                } else {
                    (POLL_INTERVAL_MS / 1000).toInt()
                }

                val newUsed = timer.usedSeconds + elapsed
                val remaining = timer.durationSeconds - newUsed

                if (remaining <= 0) {
                    activeTimers[pkg] = timer.copy(
                        usedSeconds = newUsed,
                        status = "blocked",
                        lastActiveTimestamp = now
                    )
                    blockedPackages.add(pkg)
                    Log.w(TAG, "*** BLOCKED: ${timer.appName} ($pkg) used=${newUsed}s/${timer.durationSeconds}s ***")

                    TimerEventModule.sendBlockedEvent(pkg, timer.appName)
                    launchBlockOverlay(timer.appName, pkg)
                    persistTimers()
                } else {
                    activeTimers[pkg] = timer.copy(
                        usedSeconds = newUsed,
                        status = "active",
                        lastActiveTimestamp = now
                    )

                    TimerEventModule.sendTickEvent(
                        pkg, timer.appName, remaining, false, "active"
                    )
                }
            } else {
                if (timer.status == "active") {
                    activeTimers[pkg] = timer.copy(
                        status = "waiting",
                        lastActiveTimestamp = 0
                    )
                }
            }
        }

        // Persist every ~15 seconds (every 5 polls)
        persistCounter++
        if (persistCounter >= 5) {
            persistCounter = 0
            persistTimers()
        }

        updateNotification()
    }

    private fun getForegroundPackage(): String? {
        try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()

            try {
                val events = usm.queryEvents(now - 10 * 60_000, now)
                val event = UsageEvents.Event()
                var lastForegroundPkg: String? = null
                var lastForegroundTime: Long = 0

                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                        if (event.timeStamp > lastForegroundTime) {
                            lastForegroundTime = event.timeStamp
                            lastForegroundPkg = event.packageName
                        }
                    }
                }

                if (lastForegroundPkg != null) {
                    return lastForegroundPkg
                }
            } catch (e: Exception) {
                Log.e(TAG, "queryEvents failed", e)
            }

            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                now - 5 * 60 * 1000,
                now
            )
            if (!stats.isNullOrEmpty()) {
                return stats.maxByOrNull { it.lastTimeUsed }?.packageName
            }

        } catch (e: Exception) {
            Log.e(TAG, "getForegroundPackage failed", e)
        }
        return null
    }

    private fun launchBlockOverlay(appName: String, packageName: String) {
        try {
            val intent = Intent(this, BlockOverlayActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("app_name", appName)
                putExtra("package_name", packageName)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch block overlay", e)
        }
    }

    // ── Persistence ──

    private fun persistTimers() {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val arr = JSONArray()
            for ((pkg, timer) in activeTimers) {
                val obj = JSONObject()
                obj.put("pkg", pkg)
                obj.put("appName", timer.appName)
                obj.put("duration", timer.durationSeconds)
                obj.put("used", timer.usedSeconds)
                obj.put("status", timer.status)
                obj.put("startDate", timer.startDate)
                arr.put(obj)
            }
            prefs.edit().putString("timers", arr.toString()).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist timers", e)
        }
    }

    // ── Notification ──

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Limitter Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Tracks app usage for your limits"
            setShowBadge(false)
        }
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val fg = lastDetectedForeground ?: "none"
        val trackingInfo = activeTimers.entries.joinToString("\n") { (_, t) ->
            "${t.appName}: ${t.usedSeconds}s/${t.durationSeconds}s [${t.status}]"
        }

        val title = "FG: $fg"
        val text = if (trackingInfo.isNotEmpty()) trackingInfo else "No timers"

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun updateNotification() {
        try {
            val nm = getSystemService(NotificationManager::class.java)
            nm.notify(NOTIFICATION_ID, buildNotification())
        } catch (_: Exception) {}
    }
}

private fun todayDate(): String {
    val cal = Calendar.getInstance()
    return "${cal.get(Calendar.YEAR)}-${cal.get(Calendar.MONTH) + 1}-${cal.get(Calendar.DAY_OF_MONTH)}"
}
