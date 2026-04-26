package com.limitter.app

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.concurrent.ConcurrentHashMap
import java.util.Collections

object TimerStateManager {
    private const val TAG = "TimerState"
    private const val PREFS_NAME = "limitter_timers"

    val activeTimers = ConcurrentHashMap<String, TimerEntry>()
    val blockedPackages: MutableSet<String> = Collections.synchronizedSet(mutableSetOf())

    data class TimerEntry(
        val packageName: String,
        val appName: String,
        val durationSeconds: Int,
        var usedSeconds: Int = 0,
        var status: String = "waiting",
        var lastActiveTimestamp: Long = 0,
        val startDate: String = todayDate(),
        val createdAt: Long = System.currentTimeMillis(),
        val clockHour: Int = -1,
        val clockMinute: Int = -1
    ) {
        val isClockTimer: Boolean get() = clockHour in 0..23 && clockMinute in 0..59
    }

    fun addTimers(appsJson: String) {
        try {
            val arr = JSONArray(appsJson)
            val today = todayDate()

            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val pkg = obj.getString("package")
                val appName = obj.optString("appName", pkg)
                val duration = obj.optString("duration", "0").toIntOrNull() ?: 0
                val initialUsed = obj.optString("usedSeconds", "0").toIntOrNull() ?: 0
                val clockH = obj.optInt("clockHour", -1)
                val clockM = obj.optInt("clockMinute", -1)

                if (duration <= 0 || pkg.isEmpty()) continue

                val existing = activeTimers[pkg]
                if (existing != null && existing.startDate == today) {
                    val cappedUsed = maxOf(existing.usedSeconds, minOf(initialUsed, duration))
                    val newStatus = when {
                        existing.status == "blocked" -> "blocked"
                        cappedUsed >= duration -> "blocked"
                        else -> existing.status
                    }
                    activeTimers[pkg] = existing.copy(
                        appName = appName,
                        durationSeconds = duration,
                        usedSeconds = cappedUsed,
                        status = newStatus,
                        clockHour = if (clockH >= 0) clockH else existing.clockHour,
                        clockMinute = if (clockM >= 0) clockM else existing.clockMinute
                    )
                    if (newStatus == "blocked") blockedPackages.add(pkg)
                    Log.w(TAG, "KEEP timer: $appName ($pkg) ${duration}s, used=${cappedUsed}s [${newStatus}]")
                } else {
                    val cappedInitialUsed = minOf(initialUsed, duration)
                    val newStatus = if (cappedInitialUsed >= duration) "blocked" else "waiting"
                    activeTimers[pkg] = TimerEntry(
                        packageName = pkg,
                        appName = appName,
                        durationSeconds = duration,
                        usedSeconds = cappedInitialUsed,
                        status = newStatus,
                        clockHour = clockH,
                        clockMinute = clockM
                    )
                    if (newStatus == "blocked") blockedPackages.add(pkg) else blockedPackages.remove(pkg)
                    Log.w(TAG, "NEW timer: $appName ($pkg) ${duration}s, used=${cappedInitialUsed}s [${newStatus}]")
                }
            }

            Log.w(TAG, "Total active timers: ${activeTimers.size}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse timers JSON", e)
        }
    }

    fun addWebsiteTimers(websitesJson: String) {
        try {
            val arr = JSONArray(websitesJson)
            val today = todayDate()

            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val domain = obj.getString("domain").trim().lowercase()
                val duration = obj.optString("duration", "0").toIntOrNull() ?: 0
                val initialUsed = obj.optString("usedSeconds", "0").toIntOrNull() ?: 0
                val clockH = obj.optInt("clockHour", -1)
                val clockM = obj.optInt("clockMinute", -1)

                if (duration <= 0 || domain.isEmpty()) continue

                val key = "website:$domain"
                val existing = activeTimers[key]
                if (existing != null && existing.startDate == today) {
                    val cappedUsed = maxOf(existing.usedSeconds, minOf(initialUsed, duration))
                    val newStatus = when {
                        existing.status == "blocked" -> "blocked"
                        cappedUsed >= duration -> "blocked"
                        else -> existing.status
                    }
                    activeTimers[key] = existing.copy(
                        appName = domain,
                        durationSeconds = duration,
                        usedSeconds = cappedUsed,
                        status = newStatus,
                        clockHour = if (clockH >= 0) clockH else existing.clockHour,
                        clockMinute = if (clockM >= 0) clockM else existing.clockMinute
                    )
                    if (newStatus == "blocked") blockedPackages.add(key)
                    Log.w(TAG, "KEEP website timer: $domain ${duration}s, used=${cappedUsed}s [${newStatus}]")
                } else {
                    val cappedInitialUsed = minOf(initialUsed, duration)
                    val newStatus = if (cappedInitialUsed >= duration) "blocked" else "waiting"
                    activeTimers[key] = TimerEntry(
                        packageName = key,
                        appName = domain,
                        durationSeconds = duration,
                        usedSeconds = cappedInitialUsed,
                        status = newStatus,
                        clockHour = clockH,
                        clockMinute = clockM
                    )
                    if (newStatus == "blocked") blockedPackages.add(key) else blockedPackages.remove(key)
                    Log.w(TAG, "NEW website timer: $domain ${duration}s, used=${cappedInitialUsed}s [${newStatus}]")
                }
            }

            Log.w(TAG, "Total active timers (apps + websites): ${activeTimers.size}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse website timers JSON", e)
        }
    }

    fun isWebsiteTimer(key: String): Boolean = key.startsWith("website:")

    fun getWebsiteDomain(key: String): String = key.removePrefix("website:")

    fun markBlocked(pkg: String) {
        blockedPackages.add(pkg)
    }

    fun clearAll() {
        activeTimers.clear()
        blockedPackages.clear()
    }

    fun resetForNewDay(pkg: String, timer: TimerEntry, today: String): TimerEntry {
        val newDuration = if (timer.isClockTimer) {
            recalculateClockDuration(timer.clockHour, timer.clockMinute)
        } else {
            timer.durationSeconds
        }
        val reset = timer.copy(
            durationSeconds = newDuration,
            usedSeconds = 0,
            status = "waiting",
            lastActiveTimestamp = 0,
            startDate = today,
            createdAt = System.currentTimeMillis()
        )
        activeTimers[pkg] = reset
        blockedPackages.remove(pkg)
        return reset
    }

    private fun recalculateClockDuration(hour: Int, minute: Int): Int {
        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (target.timeInMillis <= now.timeInMillis) {
            target.add(Calendar.DAY_OF_MONTH, 1)
        }
        return maxOf(0, ((target.timeInMillis - now.timeInMillis) / 1000).toInt())
    }

    fun updateTimer(pkg: String, timer: TimerEntry) {
    val previous = activeTimers[pkg]
    if (previous != null && previous.status == "blocked" && timer.status != "blocked") {
        Log.w(TAG, "PROTECT: refused to un-block $pkg (was blocked used=${previous.usedSeconds}/${previous.durationSeconds}, attempted status=${timer.status})")
        return
    }
    activeTimers[pkg] = timer
}

    fun persistToPrefs(context: Context) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val arr = JSONArray()
            for ((pkg, timer) in activeTimers) {
                val obj = JSONObject()
                obj.put("pkg", pkg)
                obj.put("appName", timer.appName)
                obj.put("duration", timer.durationSeconds)
                obj.put("used", timer.usedSeconds)
                obj.put("status", timer.status)
                obj.put("startDate", timer.startDate)
                obj.put("createdAt", timer.createdAt)
                obj.put("clockHour", timer.clockHour)
                obj.put("clockMinute", timer.clockMinute)
                arr.put(obj)
            }
            prefs.edit().putString("timers", arr.toString()).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist timers", e)
        }
    }

    fun loadFromPrefs(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString("timers", null) ?: return
        val today = todayDate()

        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val pkg = obj.getString("pkg")
                val startDate = obj.optString("startDate", "")

                if (startDate != today) continue

                // A session cannot survive process death — coerce "active" back to "waiting"
                // so the next foreground poll re-anchors lastActiveTimestamp cleanly.
                val persistedStatus = obj.getString("status")
                val status = if (persistedStatus == "active") "waiting" else persistedStatus

                val clockH = obj.optInt("clockHour", -1)
                val clockM = obj.optInt("clockMinute", -1)
                val savedDuration = obj.getInt("duration")
                val effectiveDuration = if (clockH in 0..23 && clockM in 0..59) {
                    recalculateClockDuration(clockH, clockM)
                } else {
                    savedDuration
                }
                val entry = TimerEntry(
                    packageName = pkg,
                    appName = obj.getString("appName"),
                    durationSeconds = effectiveDuration,
                    usedSeconds = obj.getInt("used"),
                    status = status,
                    lastActiveTimestamp = 0,
                    startDate = startDate,
                    createdAt = obj.optLong("createdAt", System.currentTimeMillis()),
                    clockHour = clockH,
                    clockMinute = clockM
                )
                activeTimers[pkg] = entry
                if (entry.status == "blocked") {
                    blockedPackages.add(pkg)
                }
            }
            Log.w(TAG, "Loaded ${activeTimers.size} persisted timers")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load persisted timers", e)
        }
    }
}

fun todayDate(): String {
    val cal = Calendar.getInstance()
    return "${cal.get(Calendar.YEAR)}-${cal.get(Calendar.MONTH) + 1}-${cal.get(Calendar.DAY_OF_MONTH)}"
}
