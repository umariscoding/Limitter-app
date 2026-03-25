package com.appguard2

import android.app.Service
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

/**
 * BlockerForegroundService runs a timer in the background
 * and triggers a system-level overlay after 30 seconds.
 */
class BlockerForegroundService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var timerRunnable: Runnable? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("BlockerService", "Starting Foreground Service")

        // 1. Create Notification Channel and start foreground
        NotificationHelper.createNotificationChannel(this)
        val notification = NotificationHelper.buildNotification(this)
        startForeground(NotificationHelper.getNotificationId(), notification)

        // 2. Start 30-second timer
        startTimer(30000)

        // 3. Return START_STICKY to ensure service restarts if killed
        return START_STICKY
    }

    /**
     * Starts a timer for the specified duration (in milliseconds).
     */
    private fun startTimer(duration: Long) {
        timerRunnable = Runnable {
            Log.d("BlockerService", "30 seconds timer expired. Showing overlay...")
            OverlayManager.showOverlay(this@BlockerForegroundService)
        }
        
        // Post the timer runnable
        handler.postDelayed(timerRunnable!!, duration)
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null // No binding
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d("BlockerService", "Destroying Service")
        
        // Clean up timer if service is stopped early
        timerRunnable?.let { handler.removeCallbacks(it) }
        
        // Remove overlay if needed when service is destroyed
        // OverlayManager.removeOverlay()
    }
}
