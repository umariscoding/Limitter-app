package com.appguard2

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.Locale

class WebsiteBlockerService : AccessibilityService() {

    private val TAG = "WebsiteBlockerService"
    private val PREFS_NAME = "WebsiteBlockerPrefs"
    private val KEY_TARGET_DOMAIN = "target_domain"
    private val KEY_TIMER_MODE = "timer_mode"
    private val KEY_MAX_DURATION_SECONDS = "max_duration_seconds"
    private val KEY_BLOCK_AT_TIMESTAMP_MS = "block_at_timestamp_ms"
    private val KEY_CONSUMED_MS = "consumed_ms"
    private val KEY_ACTIVE_SINCE_MS = "active_since_ms"
    private val KEY_WEBSITE_BLOCKED = "website_blocked"
    private val ticker = Handler(Looper.getMainLooper())

    private var lastDetectedUrl = ""
    private var lastDetectionTime = 0L
    private var isTargetCurrentlyOpen = false
    private var isTickerRunning = false

    private val supportedBrowsers = setOf(
        "com.android.chrome",
        "com.microsoft.emmx",
        "org.mozilla.firefox",
        "com.brave.browser",
        "com.sec.android.app.sbrowser",
        "com.opera.browser"
    )

    private val tickRunnable = object : Runnable {
        override fun run() {
            if (!isTickerRunning) return

            try {
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val configuredDomain = prefs.getString(KEY_TARGET_DOMAIN, "")?.trim().orEmpty()
                if (configuredDomain.isNotBlank()) {
                    evaluateTimerState(prefs, configuredDomain)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Ticker error: ${e.message}")
            }

            if (isTickerRunning) {
                ticker.postDelayed(this, 1000)
            }
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return
        if (!supportedBrowsers.contains(packageName)) {
            if (isTargetCurrentlyOpen) {
                isTargetCurrentlyOpen = false
                pauseDurationTimerIfNeeded()
            }
            return
        }

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val configuredDomain = prefs.getString(KEY_TARGET_DOMAIN, "")?.trim().orEmpty()
        if (configuredDomain.isBlank()) return

        val rootNode = rootInActiveWindow ?: return

        val url = findUrl(rootNode, packageName)
        val detectedDomain = extractDomain(url ?: "")
        val matchesTarget = when {
            detectedDomain != null -> domainMatches(detectedDomain, configuredDomain)
            else -> containsConfiguredDomain(rootNode, configuredDomain)
        }

        // Filter duplicates and rapid repeated detections
        val now = System.currentTimeMillis()
        if (!url.isNullOrBlank() && url == lastDetectedUrl && now - lastDetectionTime < 1000) {
            return
        }

        lastDetectedUrl = url ?: ""
        lastDetectionTime = now

        Log.d(TAG, "Detected URL: ${url ?: "N/A"}, target=$configuredDomain, match=$matchesTarget")

        if (matchesTarget) {
            isTargetCurrentlyOpen = true
        } else {
            isTargetCurrentlyOpen = false
            pauseDurationTimerIfNeeded()
        }

        evaluateTimerState(prefs, configuredDomain)
    }

    private fun evaluateTimerState(prefs: android.content.SharedPreferences, configuredDomain: String) {
        val now = System.currentTimeMillis()
        val isBlocked = prefs.getBoolean(KEY_WEBSITE_BLOCKED, false)
        val mode = prefs.getString(KEY_TIMER_MODE, "duration")?.lowercase(Locale.US) ?: "duration"

        if (isBlocked) {
            if (isTargetCurrentlyOpen) {
                showOverlay()
            }
            return
        }

        if (mode == "clock") {
            val blockAt = prefs.getLong(KEY_BLOCK_AT_TIMESTAMP_MS, 0L)
            if (isTargetCurrentlyOpen && blockAt > 0L && now >= blockAt) {
                prefs.edit()
                    .putBoolean(KEY_WEBSITE_BLOCKED, true)
                    .putLong(KEY_ACTIVE_SINCE_MS, 0L)
                    .apply()
                Log.d(TAG, "Clock timer reached for $configuredDomain")
                showOverlay()
            }
            return
        }

        val activeSince = prefs.getLong(KEY_ACTIVE_SINCE_MS, 0L)
        val consumedMs = prefs.getLong(KEY_CONSUMED_MS, 0L)
        val maxDurationSeconds = prefs.getInt(KEY_MAX_DURATION_SECONDS, 60).coerceAtLeast(1)
        val maxDurationMs = maxDurationSeconds * 1000L

        if (!isTargetCurrentlyOpen) {
            return
        }

        val effectiveActiveSince = if (activeSince > 0L) {
            activeSince
        } else {
            prefs.edit().putLong(KEY_ACTIVE_SINCE_MS, now).apply()
            Log.d(TAG, "Started website timer for $configuredDomain")
            now
        }

        val liveConsumedMs = consumedMs + (now - effectiveActiveSince).coerceAtLeast(0L)
        if (liveConsumedMs >= maxDurationMs) {
            prefs.edit()
                .putBoolean(KEY_WEBSITE_BLOCKED, true)
                .putLong(KEY_CONSUMED_MS, maxDurationMs)
                .putLong(KEY_ACTIVE_SINCE_MS, 0L)
                .apply()
            Log.d(TAG, "Duration timer reached for $configuredDomain")
            showOverlay()
        }
    }

    private fun pauseDurationTimerIfNeeded() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val mode = prefs.getString(KEY_TIMER_MODE, "duration")?.lowercase(Locale.US) ?: "duration"
        if (mode != "duration") return

        val activeSince = prefs.getLong(KEY_ACTIVE_SINCE_MS, 0L)
        if (activeSince <= 0L) return

        val now = System.currentTimeMillis()
        val consumedMs = prefs.getLong(KEY_CONSUMED_MS, 0L)
        val updatedConsumedMs = consumedMs + (now - activeSince).coerceAtLeast(0L)

        prefs.edit()
            .putLong(KEY_CONSUMED_MS, updatedConsumedMs)
            .putLong(KEY_ACTIVE_SINCE_MS, 0L)
            .apply()

        Log.d(TAG, "Paused website timer; consumedMs=$updatedConsumedMs")
    }

    private fun extractDomain(rawUrl: String): String? {
        val trimmed = rawUrl.trim().lowercase(Locale.US)
        if (trimmed.isBlank()) return null

        val withScheme = if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            trimmed
        } else {
            "https://$trimmed"
        }

        val host = try {
            Uri.parse(withScheme).host
        } catch (_: Exception) {
            null
        }

        return host?.removePrefix("www.")?.trim()?.takeIf { it.isNotBlank() }
    }

    private fun domainMatches(currentDomain: String, configuredDomain: String): Boolean {
        if (currentDomain == configuredDomain) return true
        return currentDomain.endsWith(".$configuredDomain")
    }

    private fun containsConfiguredDomain(rootNode: AccessibilityNodeInfo, configuredDomain: String): Boolean {
        val normalized = configuredDomain.lowercase(Locale.US)
        return searchNodeText(rootNode, normalized)
    }

    private fun searchNodeText(node: AccessibilityNodeInfo, configuredDomain: String): Boolean {
        val text = node.text?.toString()?.lowercase(Locale.US)
        val contentDescription = node.contentDescription?.toString()?.lowercase(Locale.US)

        if ((text != null && text.contains(configuredDomain)) ||
            (contentDescription != null && contentDescription.contains(configuredDomain))) {
            return true
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = searchNodeText(child, configuredDomain)
            child.recycle()
            if (found) return true
        }

        return false
    }

    private fun findUrl(rootNode: AccessibilityNodeInfo, packageName: String): String? {
        val candidateIds = when (packageName) {
            "com.android.chrome" -> listOf(
                "com.android.chrome:id/url_bar",
                "com.android.chrome:id/location_bar_edit_text"
            )
            "com.microsoft.emmx" -> listOf(
                "com.microsoft.emmx:id/url_bar",
                "com.microsoft.emmx:id/search_box_text"
            )
            "org.mozilla.firefox" -> listOf(
                "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
                "org.mozilla.firefox:id/url_bar_title"
            )
            "com.brave.browser" -> listOf(
                "com.brave.browser:id/url_bar",
                "com.brave.browser:id/location_bar_edit_text"
            )
            "com.sec.android.app.sbrowser" -> listOf(
                "com.sec.android.app.sbrowser:id/location_bar_edit_text",
                "com.sec.android.app.sbrowser:id/url_bar"
            )
            "com.opera.browser" -> listOf(
                "com.opera.browser:id/url_field"
            )
            else -> emptyList()
        }

        candidateIds.forEach { viewId ->
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(viewId)
            if (nodes != null && nodes.isNotEmpty()) {
                val url = nodes[0].text?.toString()?.trim()
                nodes.forEach { it.recycle() }
                if (!url.isNullOrBlank()) {
                    return url
                }
            }
        }

        // Fallback: search for nodes that look like a URL bar (less reliable)
        return findUrlByRecursion(rootNode)
    }

    private fun findUrlByRecursion(node: AccessibilityNodeInfo): String? {
        if (node.className == "android.widget.EditText" || node.className == "android.view.View") {
            val text = node.text?.toString()
            if (text != null && (text.contains(".") || text.contains("http"))) {
                return text
            }
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findUrlByRecursion(child)
            if (result != null) return result
        }
        return null
    }

    private fun showOverlay() {
        val intent = Intent(this, WebsiteBlockerOverlayActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(intent)
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isTickerRunning = true
        ticker.removeCallbacks(tickRunnable)
        ticker.post(tickRunnable)
        Log.d(TAG, "Service connected and ticker started")
    }

    override fun onDestroy() {
        super.onDestroy()
        isTickerRunning = false
        ticker.removeCallbacksAndMessages(null)
        Log.d(TAG, "Service destroyed and ticker stopped")
    }

    override fun onInterrupt() {
        Log.d(TAG, "Service interrupted")
    }
}
