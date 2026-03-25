package com.appguard2

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * NotificationHelper handles the creation of notification channels and
 * the construction of notifications for the Foreground Service.
 */
object NotificationHelper {
    private const val CHANNEL_ID = "BlockerForegroundServiceChannel"
    private const val CHANNEL_NAME = "Limitter Blocker Service"
    private const val NOTIFICATION_ID = 9991

    /**
     * Creates a notification channel for Android O and above.
     */
    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Running Limitter background timer"
                setSound(null, null) // Silent notification for cleaner experience
                enableLights(true)
                lightColor = Color.BLUE
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    /**
     * Builds the notification to be displayed by the foreground service.
     */
    fun buildNotification(context: Context): Notification {
        // Build an intent that opens the app when the notification is clicked
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Limitter Active")
            .setContentText("Timer is running (30s POC)")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    fun getNotificationId(): Int = NOTIFICATION_ID
}
