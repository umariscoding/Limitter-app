package com.limitter

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.util.Log

object ForegroundDetector {
    private const val TAG = "FgDetector"

    fun detect(context: Context): String? {
        try {
            val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()

            try {
                val events = usm.queryEvents(now - 10 * 60_000, now)
                val event = UsageEvents.Event()
                var lastForegroundPkg: String? = null
                var lastForegroundTime: Long = 0

                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                        if (event.timeStamp > lastForegroundTime) {
                            lastForegroundTime = event.timeStamp
                            lastForegroundPkg = event.packageName
                        }
                    }
                }

                if (lastForegroundPkg != null) {
                    return lastForegroundPkg
                }
            } catch (e: Exception) {
                Log.e(TAG, "queryEvents failed", e)
            }

            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                now - 5 * 60 * 1000,
                now
            )
            if (!stats.isNullOrEmpty()) {
                return stats.maxByOrNull { it.lastTimeUsed }?.packageName
            }
        } catch (e: Exception) {
            Log.e(TAG, "detect failed", e)
        }
        return null
    }
}
