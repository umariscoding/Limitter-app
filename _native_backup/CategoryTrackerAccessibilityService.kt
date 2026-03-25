package com.appguard2

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log

class CategoryTrackerAccessibilityService : AccessibilityService() {
    private val TAG = "CategoryTracker"

    // --- TIMER ---
    private var currentCategory: String? = null
    private var sharedTimeS: Int = 0
    private val LIMIT_S = 3
    private val handler = Handler(Looper.getMainLooper())
    private var timerRunnable: Runnable? = null
    private var blocked = false

    // --- DUPLICATE FILTER ---
    private var lastDetectedItem: String = ""

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "🟢 SERVICE CONNECTED - All-in-one tracker ready")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return

        // Only care about window changes
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            return
        }

        var detectedUrl: String? = null

        // 1. Detect URL if in browser
        if (packageName == "com.android.chrome" || packageName == "com.microsoft.emmx") {
            val rootNode = rootInActiveWindow
            if (rootNode != null) {
                detectedUrl = findUrl(rootNode, packageName)
                rootNode.recycle()
            }
        }

        // 2. Detect category
        val category = detectCategory(packageName, detectedUrl)

        // 3. Build a unique key for duplicate filter
        val itemKey = detectedUrl ?: packageName

        // Only process if something actually changed
        if (itemKey == lastDetectedItem) return
        lastDetectedItem = itemKey

        Log.d(TAG, "🔍 Item: $itemKey | Category: ${category ?: "None"}")

        // 4. Handle category logic
        if (category != null) {
            if (blocked) {
                Log.d(TAG, "⛔ Category already BLOCKED! Showing overlay immediately.")
                showBlockScreen()
                return
            }
            if (currentCategory == null) {
                currentCategory = category
                startTimer()
            }
        } else {
            if (currentCategory != null) {
                currentCategory = null
                stopTimer()
            }
        }
    }

    private fun detectCategory(pkg: String, url: String?): String? {
        val lowerUrl = url?.lowercase() ?: ""

        return when {
            // URL-based detection
            lowerUrl.contains("x.com")        -> "social"
            lowerUrl.contains("twitter.com")  -> "social"
            lowerUrl.contains("facebook.com") -> "social"
            lowerUrl.contains("instagram.com")-> "social"
            lowerUrl.contains("google.com")   -> "social"
            // Package-based detection
            pkg == "com.facebook.katana"       -> "social"
            pkg == "com.instagram.android"     -> "social"
            pkg == "com.twitter.android"       -> "social"
            else -> null
        }
    }

    private fun startTimer() {
        if (timerRunnable != null) return
        Log.d(TAG, "⏱ Timer Started for: $currentCategory")

        timerRunnable = object : Runnable {
            override fun run() {
                sharedTimeS++
                Log.d(TAG, "📈 Time for Social Media: $sharedTimeS s / $LIMIT_S s")

                if (sharedTimeS >= LIMIT_S) {
                    Log.d(TAG, "⛔ LIMIT REACHED! Blocking...")
                    blocked = true
                    showBlockScreen()
                    stopTimer()
                } else {
                    handler.postDelayed(this, 1000)
                }
            }
        }
        // Start after 1 second (first tick)
        handler.postDelayed(timerRunnable!!, 1000)
    }

    private fun stopTimer() {
        timerRunnable?.let { handler.removeCallbacks(it) }
        timerRunnable = null
    }

    private fun showBlockScreen() {
        // Send user to Home first
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(homeIntent)

        // Then open our block overlay
        val blockIntent = Intent(this, WebsiteBlockerOverlayActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(blockIntent)
    }

    private fun findUrl(rootNode: AccessibilityNodeInfo, packageName: String): String? {
        val urlBarIds = when (packageName) {
            "com.android.chrome" -> listOf(
                "com.android.chrome:id/url_bar",
                "com.android.chrome:id/location_bar_edit_text",
                "com.android.chrome:id/search_box_text"
            )
            "com.microsoft.emmx" -> listOf(
                "com.microsoft.emmx:id/url_bar",
                "com.microsoft.emmx:id/search_box_text"
            )
            else -> emptyList()
        }

        for (id in urlBarIds) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
            if (nodes != null && nodes.isNotEmpty()) {
                val url = nodes[0].text?.toString()
                nodes.forEach { it.recycle() }
                if (!url.isNullOrBlank() && url.contains(".")) return url
            }
        }

        return findUrlByRecursion(rootNode)
    }

    private fun findUrlByRecursion(node: AccessibilityNodeInfo): String? {
        val className = node.className?.toString() ?: ""
        val text = node.text?.toString()

        if (!text.isNullOrBlank() && text.contains(".") && !text.contains(" ")) {
            if (className.contains("EditText") || className.contains("View")) {
                return text
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val result = findUrlByRecursion(child)
            if (result != null) {
                child.recycle()
                return result
            }
            child.recycle()
        }
        return null
    }

    override fun onInterrupt() {}
}
