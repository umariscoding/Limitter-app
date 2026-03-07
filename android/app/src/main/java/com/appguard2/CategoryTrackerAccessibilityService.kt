package com.appguard2

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.util.Log

class CategoryTrackerAccessibilityService : AccessibilityService() {
    private val TAG = "CategoryTrackingJS"
    private var lastPackage = ""
    private var lastUrl: String? = null
    private var lastDetectionTime = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return
        var currentUrl: String? = null

        // 1. Detect Browser URL (if it's a browser)
        if (packageName == "com.android.chrome" || packageName == "com.microsoft.emmx") {
            val rootNode = rootInActiveWindow
            if (rootNode != null) {
                currentUrl = findUrl(rootNode, packageName)
            }
        }

        // 2. Filter duplicates and rapid detections
        val now = System.currentTimeMillis()
        if (packageName == lastPackage && currentUrl == lastUrl && now - lastDetectionTime < 1000) {
            return
        }

        lastPackage = packageName
        lastUrl = currentUrl
        lastDetectionTime = now

        // 3. Broadcast Change
        broadcastChange(packageName, currentUrl)
    }

    private fun broadcastChange(packageId: String, url: String?) {
        val intent = Intent("com.appguard2.CATEGORY_TRACKER_CHANGE").apply {
            putExtra("package", packageId)
            if (url != null) putExtra("url", url)
            setPackage(packageName) // Send only to our app
        }
        sendBroadcast(intent)
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

    override fun onInterrupt() {
        Log.d(TAG, "Service onInterrupt")
    }
}
