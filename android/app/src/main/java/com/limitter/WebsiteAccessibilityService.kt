package com.limitter

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class WebsiteAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "WebsiteA11y"
        private const val MAX_TREE_DEPTH = 8

        @Volatile var currentBrowserUrl: String? = null
        @Volatile var lastUrlUpdateTimestamp: Long = 0
        @Volatile var isRunning: Boolean = false

        private val BROWSER_URL_VIEW_IDS = listOf(
            "com.android.chrome:id/url_bar",
            "com.chrome.beta:id/url_bar",
            "com.chrome.dev:id/url_bar",
            "com.chrome.canary:id/url_bar",
            "com.brave.browser:id/url_bar",
            "com.microsoft.emmx:id/url_bar",
            "org.mozilla.firefox:id/url_bar_title",
            "org.mozilla.firefox_beta:id/url_bar_title",
            "com.opera.browser:id/url_field",
            "com.opera.mini.native:id/url_field",
            "com.samsung.android.app.sbrowser:id/location_bar_edit_text",
            "com.sec.android.app.sbrowser:id/location_bar_edit_text",
            "com.duckduckgo.mobile.android:id/omnibarTextInput",
            "com.vivaldi.browser:id/url_bar",
        )
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isRunning = true
        Log.w(TAG, "WebsiteAccessibilityService connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val pkg = event.packageName?.toString() ?: return
        if (!WebsiteDomainMatcher.isBrowser(pkg)) return

        val eventType = event.eventType
        if (eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return
        }

        val root = try { rootInActiveWindow } catch (_: Exception) { null } ?: return

        try {
            val url = findUrlFromViewIds(root) ?: findUrlInNodeTree(root, 0)

            if (url != null && looksLikeUrl(url)) {
                currentBrowserUrl = url
                lastUrlUpdateTimestamp = System.currentTimeMillis()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error reading URL", e)
        } finally {
            try { root.recycle() } catch (_: Exception) {}
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "WebsiteAccessibilityService interrupted")
        currentBrowserUrl = null
    }

    override fun onDestroy() {
        isRunning = false
        currentBrowserUrl = null
        lastUrlUpdateTimestamp = 0
        Log.w(TAG, "WebsiteAccessibilityService destroyed")
        super.onDestroy()
    }

    private fun findUrlFromViewIds(root: AccessibilityNodeInfo): String? {
        for (viewId in BROWSER_URL_VIEW_IDS) {
            try {
                val nodes = root.findAccessibilityNodeInfosByViewId(viewId)
                if (nodes.isNullOrEmpty()) continue
                val text = nodes[0].text?.toString()
                nodes.forEach { try { it.recycle() } catch (_: Exception) {} }
                if (!text.isNullOrBlank()) return text
            } catch (_: Exception) {
                continue
            }
        }
        return null
    }

    private fun findUrlInNodeTree(node: AccessibilityNodeInfo, depth: Int): String? {
        if (depth > MAX_TREE_DEPTH) return null

        try {
            val className = node.className?.toString() ?: ""
            if (className.contains("EditText") && node.isFocusable) {
                val text = node.text?.toString()
                if (!text.isNullOrBlank() && looksLikeUrl(text)) {
                    return text
                }
            }

            for (i in 0 until node.childCount) {
                val child = node.getChild(i) ?: continue
                val result = findUrlInNodeTree(child, depth + 1)
                try { child.recycle() } catch (_: Exception) {}
                if (result != null) return result
            }
        } catch (_: Exception) {}

        return null
    }

    private fun looksLikeUrl(text: String): Boolean {
        return text.length >= 4 && text.contains('.') && !text.contains(' ')
    }
}
