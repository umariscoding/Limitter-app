package com.appguard2

import android.app.*
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.SystemClock
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.*
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

// Data class to represent a single app timer
data class AppTimer(
    val packageName: String,
    val appName: String,
    val durationSeconds: Int,
    var endTimeMillis: Long = 0,
    var isStarted: Boolean = false,
    var isBlocked: Boolean = false,
    var timerType: String = "duration" // "duration" or "clock"
)

class LimitterService : Service() {
    companion object {
        var instance: LimitterService? = null
            private set
            
        fun getActiveTimers(): Map<String, AppTimer> {
            return instance?.appTimers ?: emptyMap()
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayViews: MutableMap<String, android.view.View?> = mutableMapOf()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val TAG = "LimitterService"

    private val appTimers = ConcurrentHashMap<String, AppTimer>()
    @Volatile private var isRunning = false
    private var lastBroadcastTime = 0L
    private var wakeLock: PowerManager.WakeLock? = null
    private var workerThread: HandlerThread? = null
    private var workerHandler: Handler? = null
    
    private val PREFS_NAME = "LimitterServicePrefs"
    private val KEY_RUNNING = "isRunning"

    private fun broadcastTick() {
        appTimers.forEach { (pkg, timer) ->
            val remaining = if (timer.isStarted) {
                ((timer.endTimeMillis - System.currentTimeMillis()) / 1000).toInt().coerceAtLeast(0)
            } else {
                timer.durationSeconds // Not started yet, show full duration
            }
            val status = when {
                timer.isBlocked -> "blocked"
                timer.isStarted -> "active"
                else -> "waiting"
            }
            val intent = Intent("com.appguard2.TIMER_TICK").apply {
                putExtra("package", pkg)
                putExtra("appName", timer.appName)
                putExtra("remaining", remaining)
                putExtra("isBlocked", timer.isBlocked)
                putExtra("status", status)
            }
            sendBroadcast(intent)
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForegroundCompat(buildNotification("AppGuard Active"))
        acquireWakeLock()
        restoreState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val command = intent?.getStringExtra("command")
        Log.d(TAG, "📱 Command: $command")

        when (command) {
            "START_TIMERS", "START" -> {
                @Suppress("UNCHECKED_CAST")
                val apps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent?.getSerializableExtra("apps", ArrayList::class.java) as? ArrayList<HashMap<String, String>>
                } else {
                    @Suppress("DEPRECATION")
                    intent?.getSerializableExtra("apps") as? ArrayList<HashMap<String, String>>
                }
                
                val payload = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent?.getSerializableExtra("payload", HashMap::class.java) as? HashMap<String, String>
                } else {
                    @Suppress("DEPRECATION")
                    intent?.getSerializableExtra("payload") as? HashMap<String, String>
                }
                
                // ========== DURATION TIMER (ORIGINAL — UNTOUCHED) ==========
                // Timer is WAITING — countdown starts when user opens this app
                if (apps != null) {
                    for (app in apps) {
                        val pkg = app["package"] ?: continue
                        val name = app["appName"] ?: pkg
                        val duration = (app["duration"] ?: "60").toIntOrNull() ?: 60
                        
                        removeBlockingOverlay(pkg)
                        
                        // Timer is WAITING — countdown starts when user opens this app
                        appTimers[pkg] = AppTimer(pkg, name, duration, 0, false, false, "duration")
                        Log.d(TAG, "✅ Timer Waiting: $name ($duration s) — starts on app open")
                    }
                } else if (payload != null) {
                    val pkg = payload["package"] ?: return START_STICKY
                    val name = payload["appName"] ?: pkg
                    val duration = (payload["duration"] ?: "60").toIntOrNull() ?: 60
                    
                    removeBlockingOverlay(pkg)
                    
                    // Timer is WAITING — countdown starts when user opens this app
                    appTimers[pkg] = AppTimer(pkg, name, duration, 0, false, false, "duration")
                    Log.d(TAG, "✅ Timer Waiting: $name ($duration s) — starts on app open")
                }
                
                isRunning = true
                saveState()
                scheduleMonitoringAlarm()
                startBackgroundTasks()
            }

            // ========== CLOCK TIMER (NEW — COMPLETELY SEPARATE) ==========
            // This is an absolute-time timer. The block fires at a specific clock time.
            "START_CLOCK_TIMER" -> {
                @Suppress("UNCHECKED_CAST")
                val clockApps = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent?.getSerializableExtra("apps", ArrayList::class.java) as? ArrayList<HashMap<String, String>>
                } else {
                    @Suppress("DEPRECATION")
                    intent?.getSerializableExtra("apps") as? ArrayList<HashMap<String, String>>
                }

                if (clockApps != null) {
                    for (app in clockApps) {
                        val pkg = app["package"] ?: continue
                        val name = app["appName"] ?: pkg
                        val hour = (app["hour"] ?: "0").toIntOrNull() ?: 0
                        val minute = (app["minute"] ?: "0").toIntOrNull() ?: 0

                        removeBlockingOverlay(pkg)

                        // Calculate the absolute block time
                        val endTime = calculateClockEndTime(hour, minute)

                        // Clock timer is STARTED immediately — it counts against the clock
                        appTimers[pkg] = AppTimer(pkg, name, 0, endTime, true, false, "clock")
                        scheduleTimerAlarm(pkg, name, endTime)
                        Log.d(TAG, "🕐 Clock Timer Started: $name — blocks at $endTime (hour=$hour, min=$minute)")
                    }
                }

                isRunning = true
                saveState()
                scheduleMonitoringAlarm()
                startBackgroundTasks()
            }

            "EXPIRE" -> {
                val pkg = intent?.getStringExtra("package") ?: return START_STICKY
                val name = intent?.getStringExtra("appName") ?: pkg
                Log.d(TAG, "⏰ EXPIRE fired for $pkg")
                
                val timer = appTimers[pkg]
                if (timer != null && timer.isStarted && !timer.isBlocked) {
                    timer.isBlocked = true
                    appTimers[pkg] = timer
                    saveState()
                    
                    // IMMEDIATELY block — user opened this app so they're on it
                    forceCloseApp(pkg)
                    mainHandler.post { showBlockingOverlay(pkg, name) }
                    Log.d(TAG, "⛔ BLOCKED: $name — timer reached 0")
                }
                scheduleNextMonitorTick()
            }

            "BLOCK_APP" -> {
                val pkg = intent?.getStringExtra("package")
                val name = intent?.getStringExtra("appName") ?: pkg
                
                if (pkg != null) {
                    appTimers[pkg] = AppTimer(pkg, name ?: pkg, 0, System.currentTimeMillis(), true, true)
                    isRunning = true
                    saveState()
                    startBackgroundTasks()
                    
                    val currentApp = getForegroundApp()
                    if (currentApp == pkg) {
                        forceCloseApp(pkg)
                        showBlockingOverlay(pkg, name ?: pkg)
                    }
                }
            }

            "STOP" -> {
                Log.d(TAG, "⏹ STOP command received")
                isRunning = false
                clearState()
                stopProcesses()
                stopSelf()
            }
            "MONITOR_TICK" -> {
                // Exact alarm chain: each tick schedules the next
                val now = System.currentTimeMillis()
                var stateChanged = false
                var hasWork = false
                val currentApp = getForegroundApp()

                appTimers.forEach { (pkg, timer) ->
                    // 1. User opened a WAITING app — start countdown
                    if (!timer.isStarted && !timer.isBlocked && currentApp == pkg) {
                        val endTime = now + (timer.durationSeconds * 1000L)
                        timer.endTimeMillis = endTime
                        timer.isStarted = true
                        appTimers[pkg] = timer
                        stateChanged = true
                        scheduleTimerAlarm(pkg, timer.appName, endTime)
                        Log.d(TAG, "▶️ TIMER STARTED (monitor): ${timer.appName}")
                    }

                    // 2. Check expiry (only if started)
                    if (timer.isStarted && !timer.isBlocked && now >= timer.endTimeMillis) {
                        timer.isBlocked = true
                        appTimers[pkg] = timer
                        stateChanged = true
                        Log.d(TAG, "🔔 EXPIRED (monitor): ${timer.appName}")
                    }

                    // 3. Enforce block
                    if (timer.isBlocked && currentApp == pkg) {
                        forceCloseApp(pkg)
                        mainHandler.post {
                            if (overlayViews[pkg] == null) {
                                showBlockingOverlay(pkg, timer.appName)
                            }
                        }
                    } else if (timer.isBlocked && currentApp != null && currentApp != pkg && overlayViews[pkg] != null && !isLauncher(currentApp)) {
                        mainHandler.post { removeBlockingOverlay(pkg) }
                    }

                    // Track if there's still work to do
                    if (!timer.isBlocked) hasWork = true
                    if (timer.isBlocked) hasWork = true // need to monitor blocked apps too
                }
                if (stateChanged) saveState()

                // Schedule next tick if we have work
                if (isRunning && hasWork) {
                    scheduleNextMonitorTick()
                }
            }

            "HEARTBEAT" -> {
                if (isRunning && monitorRunnable == null) {
                    Log.d(TAG, "💓 Heartbeat: Monitor dead, restarting")
                    startBackgroundTasks()
                } else if (isRunning) {
                    Log.d(TAG, "💓 Heartbeat: Monitor alive")
                }
            }
        }
        return START_STICKY
    }

    private fun scheduleTimerAlarm(packageName: String, appName: String, endTimeMillis: Long) {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(this, AlarmReceiver::class.java).apply {
                putExtra("command", "EXPIRE")
                putExtra("package", packageName)
                putExtra("appName", appName)
            }
            val requestCode = packageName.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            
            // setExactAndAllowWhileIdle wakes device even in Doze mode
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endTimeMillis, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, endTimeMillis, pendingIntent)
            }
            Log.d(TAG, "⏰ Exact Alarm (Broadcast) set for $packageName at $endTimeMillis")
        } catch (e: Exception) {
            Log.e(TAG, "Alarm schedule failed: ${e.message}")
        }
    }

    private fun cancelTimerAlarm(packageName: String) {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(this, AlarmReceiver::class.java)
            val requestCode = packageName.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(this, requestCode, intent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
            pendingIntent?.let { alarmManager.cancel(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Alarm cancel failed: ${e.message}")
        }
    }

    private fun scheduleMonitoringAlarm() {
        scheduleNextMonitorTick()
    }

    // Exact alarm chain: each tick schedules the next one
    // This bypasses Android's 60-second minimum for setRepeating
    private fun scheduleNextMonitorTick() {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(this, AlarmReceiver::class.java).apply {
                putExtra("command", "MONITOR_TICK")
            }
            val pendingIntent = PendingIntent.getBroadcast(this, 8888, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            
            val triggerAt = System.currentTimeMillis() + 3000 // 3 seconds
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Monitor tick schedule failed: ${e.message}")
        }
    }

    private fun cancelMonitoringAlarm() {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(this, AlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(this, 8888, intent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
            pendingIntent?.let { alarmManager.cancel(it) }
        } catch (e: Exception) {}
    }

    private var monitorRunnable: Runnable? = null

    private fun startBackgroundTasks() {
        // Stop old worker if running
        monitorRunnable?.let { workerHandler?.removeCallbacks(it) }
        workerThread?.quitSafely()
        
        // Create a DEDICATED thread for monitoring — NOT the main thread
        // This is critical because React Native uses the main thread heavily
        // and Android can throttle the main thread when the app is in background
        workerThread = HandlerThread("AppGuardWorker", Thread.MAX_PRIORITY).also { it.start() }
        workerHandler = Handler(workerThread!!.looper)
        
        Log.d(TAG, "🚀 Dedicated worker thread started")
        
        monitorRunnable = object : Runnable {
            override fun run() {
                if (!isRunning) return
                
                try {
                    val now = System.currentTimeMillis()
                    var stateChanged = false
                    var currentApp: String? = null
                    
                    try {
                        currentApp = getForegroundApp()
                    } catch (e: Exception) {
                        Log.e(TAG, "getForegroundApp error: ${e.message}")
                    }

                    appTimers.forEach { (pkg, timer) ->
                        // 1. User opened a WAITING app — START the countdown now
                        if (!timer.isStarted && !timer.isBlocked && currentApp == pkg) {
                            val endTime = System.currentTimeMillis() + (timer.durationSeconds * 1000L)
                            timer.endTimeMillis = endTime
                            timer.isStarted = true
                            appTimers[pkg] = timer
                            stateChanged = true
                            scheduleTimerAlarm(pkg, timer.appName, endTime)
                            Log.d(TAG, "▶️ TIMER STARTED: ${timer.appName} — ${timer.durationSeconds}s countdown")
                        }

                        // 2. Check Timer Expiry (only if started)
                        if (timer.isStarted && !timer.isBlocked && now >= timer.endTimeMillis) {
                            timer.isBlocked = true
                            appTimers[pkg] = timer
                            stateChanged = true
                            Log.d(TAG, "🔔 EXPIRED: ${timer.appName}")
                        }

                        // 3. Enforce Block (overlay/UI must run on main thread)
                        if (timer.isBlocked) {
                            if (currentApp == pkg) {
                                forceCloseApp(pkg)
                                mainHandler.post {
                                    if (overlayViews[pkg] == null) {
                                        showBlockingOverlay(pkg, timer.appName)
                                    }
                                }
                            } else if (currentApp != null && currentApp != pkg && overlayViews[pkg] != null && !isLauncher(currentApp)) {
                                mainHandler.post { removeBlockingOverlay(pkg) }
                            }
                        }
                    }

                    if (stateChanged) saveState()

                    // Broadcast updates every 1 second
                    if (now - lastBroadcastTime >= 1000) {
                        broadcastTick()
                        mainHandler.post { updateNotification() }
                        lastBroadcastTime = now
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Monitor loop error: ${e.message}")
                }
                
                // ALWAYS re-schedule on the worker thread
                if (isRunning) {
                    workerHandler?.postDelayed(this, 1000)
                }
            }
        }
        
        workerHandler?.post(monitorRunnable!!)
        setupHeartbeat()
    }

    private fun setupHeartbeat() {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(this, LimitterService::class.java).apply { putExtra("command", "HEARTBEAT") }
            val pendingIntent = PendingIntent.getService(this, 999, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            
            // Alarm every 1 minute to keep service alive
            alarmManager.setRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + 60000, 60000, pendingIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Heartbeat setup failed: ${e.message}")
        }
    }

    private fun forceCloseApp(packageName: String) {
        try {
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val killMethod = ActivityManager::class.java.getMethod("forceStopPackage", String::class.java)
            killMethod.invoke(activityManager, packageName)
            Log.d(TAG, "🛑 Force closed: $packageName")
            
            startActivity(Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to force close: ${e.message}")
        }
    }

    private fun showBlockingOverlay(packageName: String, appName: String) {
        if (overlayViews[packageName] != null) return
        if (!android.provider.Settings.canDrawOverlays(this)) return

        try {
            windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else
                    @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_FULLSCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                PixelFormat.TRANSLUCENT
            )

            val root = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(Color.parseColor("#0f0c29"))
                gravity = Gravity.CENTER
                setPadding(80, 80, 80, 80)
                isClickable = true
            }

            root.addView(TextView(this).apply {
                text = "🚫"
                textSize = 80f
                gravity = Gravity.CENTER
            })

            root.addView(TextView(this).apply {
                text = "Time's Up!"
                setTextColor(Color.parseColor("#ef4444"))
                textSize = 34f
                setTypeface(null, android.graphics.Typeface.BOLD)
                gravity = Gravity.CENTER
                setPadding(0, 20, 0, 20)
            })

            root.addView(TextView(this).apply {
                text = "$appName is blocked.\nTake a break! 💪"
                setTextColor(Color.parseColor("#c4b5fd"))
                textSize = 17f
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 60)
            })

            root.addView(Button(this).apply {
                text = "🏠 Go Home"
                setBackgroundColor(Color.parseColor("#7c3aed"))
                setTextColor(Color.WHITE)
                textSize = 18f
                setPadding(80, 40, 80, 40)
                setOnClickListener {
                    // Remove overlay
                    removeBlockingOverlay(packageName)
                    // Clear this app's timer so it can be opened freely again
                    appTimers.remove(packageName)
                    cancelTimerAlarm(packageName)
                    saveState()
                    Log.d(TAG, "🏠 Go Home: $packageName unblocked")
                    // Open App Guard
                    try {
                        val intent = packageManager.getLaunchIntentForPackage("com.appguard2")
                        if (intent != null) {
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            startActivity(intent)
                        }
                    } catch (_: Exception) {}
                }
            })

            windowManager?.addView(root, params)
            overlayViews[packageName] = root
            Log.d(TAG, "✅ Overlay shown: $appName")
        } catch (e: Exception) {
            Log.e(TAG, "Overlay error: ${e.message}")
            overlayViews.remove(packageName)
        }
    }

    private fun removeBlockingOverlay(packageName: String) {
        overlayViews[packageName]?.let {
            try {
                windowManager?.removeView(it)
            } catch (_: Exception) {}
        }
        overlayViews[packageName] = null
    }

    private fun removeAllOverlays() {
        overlayViews.forEach { (_, view) ->
            try { view?.let { windowManager?.removeView(it) } } catch (_: Exception) {}
        }
        overlayViews.clear()
    }


    private fun isLauncher(packageName: String?): Boolean {
        if (packageName == null) return false
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolveInfo = packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        return packageName == resolveInfo?.activityInfo?.packageName
    }

    private fun getForegroundApp(): String? {
        return try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(now - 5000, now)
            val event = UsageEvents.Event()
            var lastPkg: String? = null
            var lastTime = 0L

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (event.timeStamp >= lastTime) {
                        lastTime = event.timeStamp
                        lastPkg = event.packageName
                    }
                }
            }

            lastPkg ?: run {
                val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, now - 5000, now)
                stats?.maxByOrNull { it.lastTimeUsed }?.packageName
            }
        } catch (e: Exception) {
            Log.e(TAG, "Foreground error: ${e.message}")
            null
        }
    }

    private fun saveState() {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val packages = appTimers.keys.toList()
            
            prefs.edit().apply {
                putStringSet("packages", packages.toSet())
                putBoolean(KEY_RUNNING, isRunning)
                packages.forEach { pkg ->
                    val timer = appTimers[pkg] ?: return@forEach
                    putInt("duration_$pkg", timer.durationSeconds)
                    putLong("endTime_$pkg", timer.endTimeMillis)
                    putString("name_$pkg", timer.appName)
                    putBoolean("started_$pkg", timer.isStarted)
                    putBoolean("blocked_$pkg", timer.isBlocked)
                    putString("type_$pkg", timer.timerType)
                }
                commit()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Save error: ${e.message}")
        }
    }

    private fun restoreState() {
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val packages = prefs.getStringSet("packages", emptySet()) ?: emptySet()

            appTimers.clear()
            packages.forEach { pkg ->
                val duration = prefs.getInt("duration_$pkg", 0)
                val endTime = prefs.getLong("endTime_$pkg", 0)
                val name = prefs.getString("name_$pkg", pkg) ?: pkg
                val isStarted = prefs.getBoolean("started_$pkg", false)
                val isBlocked = prefs.getBoolean("blocked_$pkg", false)
                val type = prefs.getString("type_$pkg", "duration") ?: "duration"
                
                if (duration > 0 || endTime > 0) {
                    appTimers[pkg] = AppTimer(pkg, name, if (duration > 0) duration else 60, endTime, isStarted, isBlocked, type)
                    if (isStarted && !isBlocked && endTime > System.currentTimeMillis()) {
                        scheduleTimerAlarm(pkg, name, endTime)
                    }
                }
            }

            if (appTimers.isNotEmpty() && prefs.getBoolean(KEY_RUNNING, false)) {
                isRunning = true
                scheduleMonitoringAlarm()
                startBackgroundTasks()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Restore error: ${e.message}")
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "LimitterChannel",
                "AppGuard Timer",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            channel.setShowBadge(true)
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, "LimitterChannel")
            .setContentTitle("AppGuard")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setSilent(true)
            .build()

    private fun updateNotification() {
        val text = when {
            appTimers.isEmpty() -> "AppGuard Active"
            else -> "AppGuard - ${appTimers.size} Timer(s)"
        }
        getSystemService(NotificationManager::class.java)?.notify(1, buildNotification(text))
    }

    private fun startForegroundCompat(n: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, n)
        }
    }

    private fun acquireWakeLock() {
        try {
            wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AppGuard::WakeLock")
                .apply { acquire(12 * 60 * 60 * 1000L) }
        } catch (e: Exception) {
            Log.e(TAG, "WakeLock error: ${e.message}")
        }
    }

    private fun stopProcesses() {
        monitorRunnable?.let { workerHandler?.removeCallbacks(it) }
        monitorRunnable = null
        workerThread?.quitSafely()
        workerThread = null
        workerHandler = null
        mainHandler.removeCallbacksAndMessages(null)
        cancelMonitoringAlarm()
        removeAllOverlays()
        wakeLock?.let { if (it.isHeld) it.release() }
    }

    private fun clearState() {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().commit()
        appTimers.clear()
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() {
        // Only stop processes, don't clear state so system can restart us
        stopProcesses()
        if (instance == this) instance = null
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (isRunning && appTimers.isNotEmpty()) {
            saveState()
        }
        
        try {
            val intent = Intent(this, LimitterService::class.java)
            val pendingIntent = PendingIntent.getService(
                this, 1, intent,
                PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
            )
            (getSystemService(Context.ALARM_SERVICE) as AlarmManager)
                .set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 1000, pendingIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Restart error: ${e.message}")
        }
        
        super.onTaskRemoved(rootIntent)
    }

    private fun calculateClockEndTime(hour: Int, minute: Int): Long {
        val calendar = java.util.Calendar.getInstance()
        val now = System.currentTimeMillis()
        calendar.timeInMillis = now
        calendar.set(java.util.Calendar.HOUR_OF_DAY, hour)
        calendar.set(java.util.Calendar.MINUTE, minute)
        calendar.set(java.util.Calendar.SECOND, 0)
        calendar.set(java.util.Calendar.MILLISECOND, 0)

        if (calendar.timeInMillis <= now) {
            calendar.add(java.util.Calendar.DAY_OF_YEAR, 1)
        }
        return calendar.timeInMillis
    }
}
