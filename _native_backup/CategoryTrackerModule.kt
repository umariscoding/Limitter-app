package com.appguard2

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Settings
import android.util.Log
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*

class CategoryTrackerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "CategoryTracker"
    private var receiver: BroadcastReceiver? = null

    // --- NATIVE TIMER ---
    private var currentCategory: String? = null
    private var sharedTimeS: Int = 0
    private val LIMIT_S = 3
    private val handler = Handler(Looper.getMainLooper())
    private var timerRunnable: Runnable? = null

    // --- DUPLICATE FILTER ---
    private var lastPackage: String = ""
    private var lastUrl: String = ""

    override fun getName(): String = "CategoryTrackerModule"

    // ✅ CORRECT FIX: Detect category using url.contains() not exact match
    private fun detectCategory(pkg: String, url: String?): String? {
        val lowerUrl = url?.lowercase() ?: ""

        // Check URL domains first (using contains for full URL like x.com/?ct=...)
        return when {
            lowerUrl.contains("x.com")       -> "social"
            lowerUrl.contains("twitter.com") -> "social"
            lowerUrl.contains("facebook.com")-> "social"
            lowerUrl.contains("instagram.com")-> "social"
            lowerUrl.contains("google.com")  -> "social"
            // Check package names
            pkg == "com.facebook.katana"      -> "social"
            pkg == "com.instagram.android"    -> "social"
            pkg == "com.twitter.android"      -> "social"
            else -> null
        }
    }

    private fun startTimer(category: String) {
        if (timerRunnable != null) return
        currentCategory = category
        Log.d(TAG, "⏱ Timer Started for Category: $category")

        timerRunnable = object : Runnable {
            override fun run() {
                sharedTimeS++
                Log.d(TAG, "📈 Time for Social Media: $sharedTimeS s / $LIMIT_S s")

                if (sharedTimeS >= LIMIT_S) {
                    Log.d(TAG, "⛔ LIMIT REACHED! Blocking...")
                    triggerBlock(category)
                    stopTimer()
                } else {
                    handler.postDelayed(this, 1000)
                }
            }
        }
        handler.post(timerRunnable!!)
    }

    private fun stopTimer() {
        timerRunnable?.let { handler.removeCallbacks(it) }
        timerRunnable = null
        currentCategory = null
        Log.d(TAG, "🛑 Timer Stopped")
    }

    @ReactMethod
    fun startTracking() {
        if (receiver != null) return
        Log.d(TAG, "🚀 Native Tracking Active (URL-contains mode)")

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val pkg = intent?.getStringExtra("package") ?: return
                val url = intent.getStringExtra("url") ?: ""

                // ✅ DUPLICATE FILTER: only process when pkg or url actually changes
                if (pkg == lastPackage && url == lastUrl) return
                lastPackage = pkg
                lastUrl = url

                val category = detectCategory(pkg, url.ifBlank { null })

                Log.d(TAG, "🔍 Item: ${if (url.isNotBlank()) url else pkg} | Category: ${category ?: "None"}")

                if (category != null) {
                    if (currentCategory == null) {
                        startTimer(category)
                    }
                } else {
                    if (currentCategory != null) {
                        stopTimer()
                    }
                }
            }
        }

        val filter = IntentFilter("com.appguard2.CATEGORY_TRACKER_CHANGE")
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            reactContext.registerReceiver(receiver, filter)
        }
    }

    @ReactMethod
    fun triggerBlock(category: String) {
        Log.d(TAG, "📵 Triggering Block Screen for: $category")
        val homeIntent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactContext.startActivity(homeIntent)

        val blockIntent = Intent(reactContext, WebsiteBlockerOverlayActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        reactContext.startActivity(blockIntent)
    }

    @ReactMethod
    fun isServiceEnabled(promise: Promise) {
        val expectedServiceName = "${reactContext.packageName}/${CategoryTrackerAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(reactContext.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        promise.resolve(enabledServices?.contains(expectedServiceName) ?: false)
    }

    @ReactMethod
    fun logToNative(message: String) {
        Log.d(TAG, message)
    }

    @Deprecated("Deprecated in Java")
    override fun onCatalystInstanceDestroy() {
        stopTimer()
        receiver?.let {
            try { reactContext.unregisterReceiver(it) } catch (e: Exception) {}
        }
        receiver = null
    }
}
