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
        // Moment this timer instance began tracking. Used to clamp session start anchors
        // so usage before the limit existed is never charged against it.
        val createdAt: Long = System.currentTimeMillis()
    )

    fun addTimers(appsJson: String) {
        try {
            val arr = JSONArray(appsJson)
            val today = todayDate()

            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val pkg = obj.getString("package")
                val appName = obj.optString("appName", pkg)
                val duration = obj.optString("duration", "0").toIntOrNull() ?: 0

                if (duration <= 0 || pkg.isEmpty()) continue

                val existing = activeTimers[pkg]
                if (existing != null && existing.startDate == today) {
                    val cappedUsed = minOf(existing.usedSeconds, duration)
                    val newStatus = when {
                        existing.status == "blocked" -> "blocked"
                        cappedUsed >= duration -> "blocked"
                        else -> existing.status
                    }
                    activeTimers[pkg] = existing.copy(
                        appName = appName,
                        durationSeconds = duration,
                        usedSeconds = cappedUsed,
                        status = newStatus
                    )
                    if (newStatus == "blocked") blockedPackages.add(pkg)
                    Log.w(TAG, "KEEP timer: $appName ($pkg) ${duration}s, used=${cappedUsed}s [${newStatus}]")
                } else {
                    activeTimers[pkg] = TimerEntry(
                        packageName = pkg,
                        appName = appName,
                        durationSeconds = duration
                    )
                    blockedPackages.remove(pkg)
                    Log.w(TAG, "NEW timer: $appName ($pkg) ${duration}s")
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

                if (duration <= 0 || domain.isEmpty()) continue

                val key = "website:$domain"
                val existing = activeTimers[key]
                if (existing != null && existing.startDate == today) {
                    val cappedUsed = minOf(existing.usedSeconds, duration)
                    val newStatus = when {
                        existing.status == "blocked" -> "blocked"
                        cappedUsed >= duration -> "blocked"
                        else -> existing.status
                    }
                    activeTimers[key] = existing.copy(
                        appName = domain,
                        durationSeconds = duration,
                        usedSeconds = cappedUsed,
                        status = newStatus
                    )
                    if (newStatus == "blocked") blockedPackages.add(key)
                    Log.w(TAG, "KEEP website timer: $domain ${duration}s, used=${cappedUsed}s [${newStatus}]")
                } else {
                    activeTimers[key] = TimerEntry(
                        packageName = key,
                        appName = domain,
                        durationSeconds = duration
                    )
                    blockedPackages.remove(key)
                    Log.w(TAG, "NEW website timer: $domain ${duration}s")
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
        val reset = timer.copy(
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

                val entry = TimerEntry(
                    packageName = pkg,
                    appName = obj.getString("appName"),
                    durationSeconds = obj.getInt("duration"),
                    usedSeconds = obj.getInt("used"),
                    status = status,
                    lastActiveTimestamp = 0,
                    startDate = startDate,
                    createdAt = obj.optLong("createdAt", System.currentTimeMillis())
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
