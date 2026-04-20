package com.limitter.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.text.SpannableStringBuilder
import android.text.style.ForegroundColorSpan
import android.text.Spanned
import android.graphics.Color
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
            h > 0 && m > 0 -> "${h}h ${m}m"
            h > 0 -> "${h}h"
            m > 0 && s > 0 -> "${m}m ${s}s"
            m > 0 -> "${m}m"
            else -> "${s}s"
        }
    }

    private fun pct(used: Int, total: Int): Int {
        if (total <= 0) return 100
        return minOf(100, (used.toLong() * 100 / total).toInt())
    }

    private fun styledLine(name: String, detail: String, detailColor: Int): SpannableStringBuilder {
        val ssb = SpannableStringBuilder()
        ssb.append(name)
        ssb.append("  ")
        val start = ssb.length
        ssb.append(detail)
        ssb.setSpan(ForegroundColorSpan(detailColor), start, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        return ssb
    }

    fun build(context: Context, foregroundPkg: String?): Notification {
        val now = System.currentTimeMillis()

        val ranked = TimerStateManager.activeTimers.values
            .sortedWith(compareByDescending<TimerStateManager.TimerEntry> { it.status == "active" }
                .thenByDescending { it.status == "blocked" }
                .thenByDescending { it.usedSeconds })
            .take(4)

        val currentApp = ranked.firstOrNull { it.status == "active" }
        val blockedCount = TimerStateManager.activeTimers.values.count { it.status == "blocked" }
        val totalTracked = TimerStateManager.activeTimers.size

        val liveUsed = if (currentApp != null) {
            val liveSession = if (currentApp.lastActiveTimestamp > 0)
                maxOf(0, ((now - currentApp.lastActiveTimestamp) / 1000).toInt()) else 0
            minOf(currentApp.durationSeconds, currentApp.usedSeconds + liveSession)
        } else 0

        val title: String
        val subtitle: String
        val progressMax: Int
        val progressCurrent: Int

        if (currentApp != null) {
            val remaining = maxOf(0, currentApp.durationSeconds - liveUsed)
            title = "\u25B6 ${currentApp.appName}"
            subtitle = "${formatTime(remaining)} remaining \u2022 ${pct(liveUsed, currentApp.durationSeconds)}% used"
            progressMax = currentApp.durationSeconds
            progressCurrent = liveUsed
        } else if (blockedCount > 0) {
            title = "\u26D4 ${blockedCount} limit${if (blockedCount > 1) "s" else ""} reached"
            subtitle = "$totalTracked limit${if (totalTracked != 1) "s" else ""} tracked"
            progressMax = 0
            progressCurrent = 0
        } else {
            title = "\u2705 Limitter active"
            subtitle = "$totalTracked limit${if (totalTracked != 1) "s" else ""} tracked"
            progressMax = 0
            progressCurrent = 0
        }

        val inbox = NotificationCompat.InboxStyle()

        for (t in ranked) {
            val liveSession = if (t.status == "active" && t.lastActiveTimestamp > 0)
                maxOf(0, ((now - t.lastActiveTimestamp) / 1000).toInt()) else 0
            val used = minOf(t.durationSeconds, t.usedSeconds + liveSession)
            val remaining = maxOf(0, t.durationSeconds - used)
            val percent = pct(used, t.durationSeconds)

            val line = when (t.status) {
                "active" -> styledLine(
                    t.appName,
                    "${formatTime(remaining)} left \u2022 ${percent}%",
                    Color.parseColor("#059669")
                )
                "blocked" -> styledLine(
                    t.appName,
                    "Limit reached",
                    Color.parseColor("#DC2626")
                )
                else -> {
                    if (t.usedSeconds > 0)
                        styledLine(
                            t.appName,
                            "${formatTime(used)} / ${formatTime(t.durationSeconds)}",
                            Color.parseColor("#64748B")
                        )
                    else
                        styledLine(
                            t.appName,
                            "${formatTime(t.durationSeconds)} limit",
                            Color.parseColor("#64748B")
                        )
                }
            }
            inbox.addLine(line)
        }

        if (totalTracked > 4) {
            inbox.setSummaryText("+${totalTracked - 4} more")
        }

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(context, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        } else null

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setStyle(inbox)
            .setSmallIcon(R.drawable.ic_notif_shield)
            .setColor(Color.parseColor("#10B981"))
            .setColorized(false)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)

        if (pendingIntent != null) {
            builder.setContentIntent(pendingIntent)
        }

        if (progressMax > 0) {
            builder.setProgress(progressMax, progressCurrent, false)
        }

        return builder.build()
    }

    fun update(context: Context, foregroundPkg: String?) {
        try {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.notify(NOTIFICATION_ID, build(context, foregroundPkg))
        } catch (_: Exception) {}
    }
}
