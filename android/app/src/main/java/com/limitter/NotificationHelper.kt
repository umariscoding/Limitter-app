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

    private fun formatTime(totalSeconds: Int): String {
        val h = totalSeconds / 3600
        val m = (totalSeconds % 3600) / 60
        val s = totalSeconds % 60
        return when {
            h > 0 -> "${h}h ${m}m"
            m > 0 -> "${m}m ${s}s"
            else -> "${s}s"
        }
    }

    fun build(context: Context, foregroundPkg: String?): Notification {
        val activeTimers = TimerStateManager.activeTimers.values.filter {
            it.status == "RUNNING" || it.status == "WARNING"
        }
        val activeCount = activeTimers.size
        val blockedCount = TimerStateManager.activeTimers.values.count { it.status == "BLOCKED" }

        val title = when {
            activeCount > 0 -> "Tracking $activeCount app${if (activeCount > 1) "s" else ""}"
            blockedCount > 0 -> "$blockedCount app${if (blockedCount > 1) "s" else ""} blocked"
            else -> "Limitter is running"
        }

        val text = if (activeTimers.isNotEmpty()) {
            activeTimers.joinToString("\n") { t ->
                val remaining = maxOf(0, t.durationSeconds - t.usedSeconds)
                "${t.appName} \u2022 ${formatTime(remaining)} left"
            }
        } else if (blockedCount > 0) {
            "Limit reached. Use an override to continue."
        } else {
            "Monitoring your screen time"
        }

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
