package com.limitter.app

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
        val detection = ForegroundDetector.detect(this)
        val detected = detection?.first
        val detectedEventTs = detection?.second
        val foregroundPkg = detected ?: lastDetectedForeground
        val now = System.currentTimeMillis()
        val today = todayDate()

        if (detected != null && detected != lastDetectedForeground) {
            lastDetectedForeground = detected
        }

        if (foregroundPkg == null) return

        for ((pkg, timer) in TimerStateManager.activeTimers.toMap()) {
            // Skip website timers entirely — they have their own polling loop below.
            // Without this guard, the app loop's session-end branch (pkg != foregroundPkg
            // is always true for a "website:..." key) would thrash website status between
            // "active" and "waiting" every poll, preventing the website blocking check from
            // ever running.
            if (TimerStateManager.isWebsiteTimer(pkg)) continue

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
                    // Anchor the session to `now`, not detectedEventTs. Anchoring to the real
                    // ACTIVITY_RESUMED timestamp would make the UI skip a second at session start:
                    // the first tick sends remaining=duration (e.g. 60), then the next poll 1s
                    // later computes sessionSeconds=2 (because the event is ~1s old) and sends
                    // remaining=58. Using `now` keeps the countdown smooth (60 → 59 → 58 …).
                    // Clamped to createdAt defensively; now >= createdAt always holds.
                    val sessionStartTs = maxOf(now, timer.createdAt)
                    TimerStateManager.updateTimer(pkg, timer.copy(
                        status = "active",
                        lastActiveTimestamp = sessionStartTs
                    ))
                    val remaining = timer.durationSeconds - timer.usedSeconds
                    TimerEventModule.sendTickEvent(pkg, timer.appName, remaining, false, "active")
                } else {
                    // Ongoing session — compute from session start, no per-tick accumulation
                    val sessionSeconds = maxOf(0, ((now - timer.lastActiveTimestamp) / 1000).toInt())
                    val effectiveUsed = timer.usedSeconds + sessionSeconds
                    val remaining = timer.durationSeconds - effectiveUsed

                    if (remaining <= 0) {
                        TimerStateManager.updateTimer(pkg, timer.copy(
                            usedSeconds = timer.durationSeconds,
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
                    // Session end — use the NEW foreground app's event timestamp (≈ the instant
                    // the target went background) so we don't over-count poll/usage-stats lag.
                    val sessionEndTs = detectedEventTs ?: now
                    val sessionSeconds = maxOf(0, ((sessionEndTs - timer.lastActiveTimestamp) / 1000).toInt())
                    val newUsed = timer.usedSeconds + sessionSeconds
                    // If this commit pushes us past the limit, transition directly to "blocked"
                    // so a subsequent dashboard refresh correctly reflects the state.
                    val newStatus = if (newUsed >= timer.durationSeconds) "blocked" else "waiting"
                    // Cap usedSeconds at the limit so the dashboard never shows "2m / 1m".
                    val cappedUsed = if (newStatus == "blocked") timer.durationSeconds else newUsed
                    TimerStateManager.updateTimer(pkg, timer.copy(
                        usedSeconds = cappedUsed,
                        status = newStatus,
                        lastActiveTimestamp = 0
                    ))
                    TimerEventModule.sendSessionEndEvent(pkg, timer.appName, sessionSeconds)
                    if (newStatus == "blocked") {
                        TimerStateManager.markBlocked(pkg)
                        TimerEventModule.sendBlockedEvent(pkg, timer.appName)
                        TimerStateManager.persistToPrefs(this)
                    }
                }
            }
        }

        // Website timer polling
        val isBrowserForeground = foregroundPkg != null && WebsiteDomainMatcher.isBrowser(foregroundPkg)
        val currentUrl = WebsiteAccessibilityService.currentBrowserUrl

        // Note: we do NOT bulk-clear websiteLastConfirmed when the browser leaves
        // foreground. Session-end below reads lastConfirmed as the anchor for
        // committed usage, so it must remain intact until the per-key session
        // ends. Individual keys are removed on their own session end (below).

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
                    // Ongoing session — usedSeconds is NOT mutated here; we only recompute
                    // effectiveUsed locally from the single lastActiveTimestamp anchor, so
                    // there is no double counting even though this runs every poll.
                    val sessionSeconds = maxOf(0, ((now - timer.lastActiveTimestamp) / 1000).toInt())
                    val effectiveUsed = timer.usedSeconds + sessionSeconds
                    val remaining = timer.durationSeconds - effectiveUsed

                    if (remaining <= 0) {
                        TimerStateManager.updateTimer(key, timer.copy(
                            usedSeconds = timer.durationSeconds,
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
                    // Session end — anchor commit at the last moment the URL was
                    // confirmed on the target domain, NOT at `now`. Otherwise the
                    // grace-period window (up to WEBSITE_GRACE_MS) would be charged
                    // to the user even though they had already left the site, and
                    // similarly any poll lag between the user leaving and this poll
                    // detecting the absence would inflate committed usage. Falling
                    // back to `now` only if we somehow never recorded a confirmation
                    // (defensive; session start always sets it).
                    val lastConfirmedAt = websiteLastConfirmed[key] ?: 0L
                    val sessionEndTs = if (lastConfirmedAt > timer.lastActiveTimestamp) lastConfirmedAt else now
                    val sessionSeconds = maxOf(0, ((sessionEndTs - timer.lastActiveTimestamp) / 1000).toInt())
                    websiteLastConfirmed.remove(key)
                    TimerStateManager.updateTimer(key, timer.copy(
                        usedSeconds = minOf(timer.durationSeconds, timer.usedSeconds + sessionSeconds),
                        status = "waiting",
                        lastActiveTimestamp = 0
                    ))
                    TimerEventModule.sendSessionEndEvent(key, domain, sessionSeconds)
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
