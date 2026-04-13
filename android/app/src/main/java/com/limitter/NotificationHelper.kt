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
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Shows real-time usage and remaining time for your limits"
            setShowBadge(false)
            setSound(null, null)
            enableVibration(false)
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

    private fun progressBar(used: Int, total: Int, width: Int = 10): String {
        if (total <= 0) return "\u2588".repeat(width)
        val filled = minOf(width, (used.toLong() * width / total).toInt())
        val empty = width - filled
        return "\u2593".repeat(filled) + "\u2591".repeat(empty)
    }

    private fun pctText(used: Int, total: Int): String {
        if (total <= 0) return "100%"
        return "${minOf(100, (used.toLong() * 100 / total).toInt())}%"
    }

    fun build(context: Context, foregroundPkg: String?): Notification {
        val now = System.currentTimeMillis()

        val ranked = TimerStateManager.activeTimers.values
            .sortedWith(compareByDescending<TimerStateManager.TimerEntry> { it.status == "active" }
                .thenByDescending { it.status == "blocked" }
                .thenByDescending { it.usedSeconds })
            .take(3)

        val currentApp = ranked.firstOrNull { it.status == "active" }

        val title = if (currentApp != null) {
            val liveSession = if (currentApp.lastActiveTimestamp > 0)
                maxOf(0, ((now - currentApp.lastActiveTimestamp) / 1000).toInt()) else 0
            val remaining = maxOf(0, currentApp.durationSeconds - currentApp.usedSeconds - liveSession)
            "\u25B6 ${currentApp.appName}  \u2022  ${formatTime(remaining)} remaining"
        } else if (ranked.any { it.status == "blocked" }) {
            "\u26D4 Limit reached"
        } else {
            "\u23F2 Limitter active"
        }

        val inbox = NotificationCompat.InboxStyle()

        for (t in ranked) {
            val liveSession = if (t.status == "active" && t.lastActiveTimestamp > 0)
                maxOf(0, ((now - t.lastActiveTimestamp) / 1000).toInt()) else 0
            val used = minOf(t.durationSeconds, t.usedSeconds + liveSession)
            val remaining = maxOf(0, t.durationSeconds - used)
            val bar = progressBar(used, t.durationSeconds)
            val pct = pctText(used, t.durationSeconds)

            val line = when (t.status) {
                "active" -> "${t.appName}  ${formatTime(remaining)} left  $bar $pct"
                "blocked" -> "${t.appName}  \u26D4 Limit reached"
                else -> {
                    if (t.usedSeconds > 0)
                        "${t.appName}  ${formatTime(remaining)} left  $bar $pct"
                    else
                        "${t.appName}  ${formatTime(t.durationSeconds)} limit"
                }
            }
            inbox.addLine(line)
        }

        val totalTracked = TimerStateManager.activeTimers.size
        if (totalTracked > 3) {
            inbox.setSummaryText("+${totalTracked - 3} more limit${if (totalTracked - 3 > 1) "s" else ""}")
        }

        val collapsed = if (currentApp != null) {
            val liveSession = if (currentApp.lastActiveTimestamp > 0)
                maxOf(0, ((now - currentApp.lastActiveTimestamp) / 1000).toInt()) else 0
            val remaining = maxOf(0, currentApp.durationSeconds - currentApp.usedSeconds - liveSession)
            "${currentApp.appName} \u2022 ${formatTime(remaining)} left"
        } else {
            "$totalTracked limit${if (totalTracked != 1) "s" else ""} tracked"
        }

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(collapsed)
            .setStyle(inbox)
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
