package com.limitter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.app.NotificationCompat

object NotificationHelper {
    const val CHANNEL_ID = "limitter_tracking"
    const val NOTIFICATION_ID = 1001

    fun createChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Limitter Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Tracks app usage for your limits"
            setShowBadge(false)
        }
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(channel)
    }

    fun build(context: Context, foregroundPkg: String?): Notification {
        val fg = foregroundPkg ?: "none"
        val trackingInfo = TimerStateManager.activeTimers.entries.joinToString("\n") { (_, t) ->
            "${t.appName}: ${t.usedSeconds}s/${t.durationSeconds}s [${t.status}]"
        }

        val title = "FG: $fg"
        val text = if (trackingInfo.isNotEmpty()) trackingInfo else "No timers"

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    fun update(context: Context, foregroundPkg: String?) {
        try {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.notify(NOTIFICATION_ID, build(context, foregroundPkg))
        } catch (_: Exception) {}
    }
}
