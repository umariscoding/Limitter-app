package com.appguard2

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class WebsiteBlockerService : AccessibilityService() {

    private val TAG = "WebsiteBlockerService"
    private val PREFS_NAME = "WebsiteBlockerPrefs"
    private val KEY_GOOGLE_BLOCKED = "google_blocked"
    private val handler = Handler(Looper.getMainLooper())
    private var isTimerRunning = false
    private var lastDetectedUrl = ""
    private var lastDetectionTime = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return
        if (packageName != "com.android.chrome" && packageName != "com.microsoft.emmx") {
            return
        }

        val rootNode = rootInActiveWindow ?: return
        val url = findUrl(rootNode, packageName) ?: return

        // Filter duplicates and rapid repeated detections
        val now = System.currentTimeMillis()
        if (url == lastDetectedUrl && now - lastDetectionTime < 1000) {
            return
        }
        
        lastDetectedUrl = url
        lastDetectionTime = now

        Log.d(TAG, "Detected URL: $url")

        if (url.contains("google.com")) {
            handleGoogleDetected()
        } else {
            if (isTimerRunning) {
                Log.d(TAG, "Navigated away from Google, cancelling timer")
                handler.removeCallbacksAndMessages(null)
                isTimerRunning = false
            }
        }
    }

    private fun findUrl(rootNode: AccessibilityNodeInfo, packageName: String): String? {
        val urlBarId = when (packageName) {
            "com.android.chrome" -> "com.android.chrome:id/url_bar"
            "com.microsoft.emmx" -> "com.microsoft.emmx:id/url_bar"
            else -> null
        }

        if (urlBarId != null) {
            val nodes = rootNode.findAccessibilityNodeInfosByViewId(urlBarId)
            if (nodes != null && nodes.isNotEmpty()) {
                val url = nodes[0].text?.toString()
                nodes.forEach { it.recycle() }
                return url
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

    private fun handleGoogleDetected() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isBlocked = prefs.getBoolean(KEY_GOOGLE_BLOCKED, false)

        if (isBlocked) {
            showOverlay()
        } else {
            if (!isTimerRunning) {
                isTimerRunning = true
                Log.d(TAG, "Google detected, starting 3s timer")
                handler.postDelayed({
                    prefs.edit().putBoolean(KEY_GOOGLE_BLOCKED, true).apply()
                    showOverlay()
                    isTimerRunning = false
                }, 3000)
            }
        }
    }

    private fun showOverlay() {
        val intent = Intent(this, WebsiteBlockerOverlayActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(intent)
    }

    override fun onInterrupt() {
        Log.d(TAG, "Service interrupted")
    }
}
