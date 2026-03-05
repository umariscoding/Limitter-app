package com.appguard2

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val command = intent.getStringExtra("command") ?: return
        Log.d("AlarmReceiver", "⏰ Alarm received: $command")

        // Forward to LimitterService
        val serviceIntent = Intent(context, LimitterService::class.java)
        serviceIntent.putExtras(intent)
        context.startForegroundService(serviceIntent)
    }
}
