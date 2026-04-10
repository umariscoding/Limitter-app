package com.limitter

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

class LimitterForegroundService : Service() {

    companion object {
        const val TAG = "LimitterSvc"
        const val POLL_INTERVAL_MS = 1000L

        const val ACTION_START_TIMERS = "START_TIMERS"
        const val ACTION_START_WEBSITE_TIMERS = "START_WEBSITE_TIMERS"
        const val ACTION_STOP = "STOP"
        const val EXTRA_APPS_JSON = "apps_json"
        const val EXTRA_WEBSITES_JSON = "websites_json"
        const val URL_FRESHNESS_MS = 300_000L  // 5 minutes — browser foreground = URL unchanged

        private var instance: LimitterForegroundService? = null

        fun isRunning(): Boolean = instance != null
    }

    private val handler = Handler(Looper.getMainLooper())
    private var isPolling = false
    private var lastDetectedForeground: String? = null
    private var persistCounter = 0
    // Grace period: when a website URL match fails temporarily, keep counting for 3 seconds
    private val websiteLastConfirmed = mutableMapOf<String, Long>()
    private val WEBSITE_GRACE_MS = 3000L

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
        NotificationHelper.createChannel(this)
        if (TimerStateManager.activeTimers.isEmpty()) {
            TimerStateManager.loadFromPrefs(this)
        }
        Log.w(TAG, "Service CREATED, timers=${TimerStateManager.activeTimers.size}")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_STICKY

        when (action) {
            ACTION_START_TIMERS -> {
                val appsJson = intent.getStringExtra(EXTRA_APPS_JSON) ?: "[]"
                TimerStateManager.addTimers(appsJson)
                startForeground(NotificationHelper.NOTIFICATION_ID, NotificationHelper.build(this, lastDetectedForeground))
                startPolling()
                TimerStateManager.persistToPrefs(this)
            }
            ACTION_START_WEBSITE_TIMERS -> {
                val websitesJson = intent.getStringExtra(EXTRA_WEBSITES_JSON) ?: "[]"
                TimerStateManager.addWebsiteTimers(websitesJson)
                startForeground(NotificationHelper.NOTIFICATION_ID, NotificationHelper.build(this, lastDetectedForeground))
                startPolling()
                TimerStateManager.persistToPrefs(this)
            }
            ACTION_STOP -> {
                stopPolling()
                TimerStateManager.clearAll()
                TimerStateManager.persistToPrefs(this)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        TimerStateManager.persistToPrefs(this)
        stopPolling()
        instance = null
        Log.w(TAG, "Service DESTROYED")
        super.onDestroy()
    }

    private fun startPolling() {
        if (isPolling) return
        isPolling = true
        handler.post(pollRunnable)
    }

    private fun stopPolling() {
        isPolling = false
        handler.removeCallbacks(pollRunnable)
    }

    private fun pollForegroundApp() {
        val detected = ForegroundDetector.detect(this)
        val foregroundPkg = detected ?: lastDetectedForeground
        val now = System.currentTimeMillis()
        val today = todayDate()

        if (detected != null && detected != lastDetectedForeground) {
            lastDetectedForeground = detected
        }

        if (foregroundPkg == null) return

        for ((pkg, timer) in TimerStateManager.activeTimers.toMap()) {
            if (timer.startDate != today) {
                TimerStateManager.resetForNewDay(pkg, timer, today)
                continue
            }

            if (pkg == foregroundPkg) {
                if (timer.status == "blocked") {
                    launchBlockOverlay(timer.appName, pkg)
                    continue
                }

                if (timer.status != "active") {
                    // Session start — record timestamp, don't count time yet
                    TimerStateManager.updateTimer(pkg, timer.copy(
                        status = "active",
                        lastActiveTimestamp = now
                    ))
                    val remaining = timer.durationSeconds - timer.usedSeconds
                    TimerEventModule.sendTickEvent(pkg, timer.appName, remaining, false, "active")
                } else {
                    // Ongoing session — compute from session start, no per-tick accumulation
                    val sessionSeconds = ((now - timer.lastActiveTimestamp) / 1000).toInt()
                    val effectiveUsed = timer.usedSeconds + sessionSeconds
                    val remaining = timer.durationSeconds - effectiveUsed

                    if (remaining <= 0) {
                        TimerStateManager.updateTimer(pkg, timer.copy(
                            usedSeconds = effectiveUsed,
                            status = "blocked",
                            lastActiveTimestamp = now
                        ))
                        TimerStateManager.markBlocked(pkg)
                        Log.w(TAG, "BLOCKED: ${timer.appName} ($pkg) used=${effectiveUsed}s/${timer.durationSeconds}s")
                        TimerEventModule.sendBlockedEvent(pkg, timer.appName)
                        launchBlockOverlay(timer.appName, pkg)
                        TimerStateManager.persistToPrefs(this)
                    } else {
                        // Don't update usedSeconds — only commit on session end or block
                        TimerEventModule.sendTickEvent(pkg, timer.appName, remaining, false, "active")
                    }
                }
            } else {
                if (timer.status == "active") {
                    // Session end — commit elapsed time from this session
                    val sessionSeconds = ((now - timer.lastActiveTimestamp) / 1000).toInt()
                    TimerStateManager.updateTimer(pkg, timer.copy(
                        usedSeconds = timer.usedSeconds + sessionSeconds,
                        status = "waiting",
                        lastActiveTimestamp = 0
                    ))
                }
            }
        }

        // Website timer polling
        val isBrowserForeground = foregroundPkg != null && WebsiteDomainMatcher.isBrowser(foregroundPkg)
        val currentUrl = WebsiteAccessibilityService.currentBrowserUrl

        if (!isBrowserForeground) {
            websiteLastConfirmed.clear()
        }

        for ((key, timer) in TimerStateManager.activeTimers.toMap()) {
            if (!TimerStateManager.isWebsiteTimer(key)) continue

            if (timer.startDate != today) {
                TimerStateManager.resetForNewDay(key, timer, today)
                continue
            }

            val domain = TimerStateManager.getWebsiteDomain(key)

            // Direct URL match
            val urlMatch = isBrowserForeground && currentUrl != null &&
                WebsiteDomainMatcher.matchesDomain(currentUrl, domain)

            if (urlMatch) {
                websiteLastConfirmed[key] = now
            }

            // Effective: true if URL matches, OR if browser is still open and last confirmed within grace period
            val lastConfirmedAt = websiteLastConfirmed[key] ?: 0L
            val isOnSite = urlMatch || (isBrowserForeground && timer.status == "active" && (now - lastConfirmedAt) < WEBSITE_GRACE_MS)

            if (isOnSite) {
                if (timer.status == "blocked") {
                    launchBlockOverlay(domain, key)
                    continue
                }

                if (timer.status != "active") {
                    // Session start
                    TimerStateManager.updateTimer(key, timer.copy(
                        status = "active",
                        lastActiveTimestamp = now
                    ))
                    val remaining = timer.durationSeconds - timer.usedSeconds
                    TimerEventModule.sendTickEvent(key, domain, remaining, false, "active")
                } else {
                    // Ongoing session — compute from absolute session start
                    val sessionSeconds = ((now - timer.lastActiveTimestamp) / 1000).toInt()
                    val effectiveUsed = timer.usedSeconds + sessionSeconds
                    val remaining = timer.durationSeconds - effectiveUsed

                    if (remaining <= 0) {
                        TimerStateManager.updateTimer(key, timer.copy(
                            usedSeconds = effectiveUsed,
                            status = "blocked",
                            lastActiveTimestamp = now
                        ))
                        TimerStateManager.markBlocked(key)
                        Log.w(TAG, "BLOCKED website: $domain used=${effectiveUsed}s/${timer.durationSeconds}s")
                        TimerEventModule.sendBlockedEvent(key, domain)
                        launchBlockOverlay(domain, key)
                        TimerStateManager.persistToPrefs(this)
                    } else {
                        TimerEventModule.sendTickEvent(key, domain, remaining, false, "active")
                    }
                }
            } else {
                if (timer.status == "active") {
                    // Session end — commit elapsed time
                    val sessionSeconds = ((now - timer.lastActiveTimestamp) / 1000).toInt()
                    websiteLastConfirmed.remove(key)
                    TimerStateManager.updateTimer(key, timer.copy(
                        usedSeconds = timer.usedSeconds + sessionSeconds,
                        status = "waiting",
                        lastActiveTimestamp = 0
                    ))
                }
            }
        }

        persistCounter++
        if (persistCounter >= 5) {
            persistCounter = 0
            TimerStateManager.persistToPrefs(this)
        }

        NotificationHelper.update(this, lastDetectedForeground)
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
}
