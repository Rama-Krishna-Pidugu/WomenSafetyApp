package com.nameisrk.aegiswomensafety

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.service.quicksettings.TileService
import android.util.Log

object FakeCallScheduler {
    private const val TAG = "FakeCallScheduler"
    const val PREFS_NAME = "aegis_fake_call_prefs"
    const val REQUEST_CODE_ALARM = 4401

    // Preference Keys
    const val KEY_CALLER_NAME = "caller_name"
    const val KEY_PHONE_NUMBER = "phone_number"
    const val KEY_RINGTONE = "ringtone"
    const val KEY_VIBRATE = "vibrate"
    const val KEY_AUTO_PLAY_VOICE = "auto_play_voice"
    const val KEY_DELAY_SECONDS = "delay_seconds"
    const val KEY_IS_SCHEDULED = "is_scheduled"
    const val KEY_SCHEDULED_TIME_MILLIS = "scheduled_time_millis"
    const val KEY_ENABLED = "enabled"

    fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Schedule a fake incoming call after delaySeconds.
     * If delaySeconds <= 0, triggers immediately.
     */
    fun schedule(context: Context, delaySeconds: Int = -1) {
        val prefs = getPrefs(context)
        val actualDelay = if (delaySeconds >= 0) {
            delaySeconds
        } else {
            prefs.getInt(KEY_DELAY_SECONDS, 0)
        }

        Log.d(TAG, "[FakeCall] Scheduling with delay: $actualDelay seconds")

        if (actualDelay <= 0) {
            // Immediate trigger
            Log.d(TAG, "[FakeCall] Immediate trigger requested")
            cancel(context)
            FakeCallBroadcastReceiver.triggerFakeCall(context)
            return
        }

        val triggerAtMillis = System.currentTimeMillis() + (actualDelay * 1000L)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

        if (alarmManager == null) {
            Log.e(TAG, "[FakeCall] AlarmManager unavailable")
            return
        }

        val intent = Intent(context, FakeCallBroadcastReceiver::class.java).apply {
            action = FakeCallBroadcastReceiver.ACTION_TRIGGER_FAKE_CALL
        }

        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE_ALARM, intent, flags)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // AlarmClock info ensures it fires reliably through Doze and battery savers
                val showIntent = Intent(context, FakeCallActivity::class.java)
                val showPendingIntent = PendingIntent.getActivity(context, 0, showIntent, flags)
                val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }

            prefs.edit()
                .putBoolean(KEY_IS_SCHEDULED, true)
                .putLong(KEY_SCHEDULED_TIME_MILLIS, triggerAtMillis)
                .apply()

            Log.d(TAG, "[FakeCall] Alarm set successfully for $triggerAtMillis")
            updateTile(context)
        } catch (e: Exception) {
            Log.e(TAG, "[FakeCall] Failed to set alarm: ${e.message}", e)
        }
    }

    /**
     * Cancel any active scheduled fake call.
     */
    fun cancel(context: Context) {
        Log.d(TAG, "[FakeCall] Cancelling scheduled fake call")
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        val intent = Intent(context, FakeCallBroadcastReceiver::class.java).apply {
            action = FakeCallBroadcastReceiver.ACTION_TRIGGER_FAKE_CALL
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE_ALARM, intent, flags)

        alarmManager?.cancel(pendingIntent)

        val prefs = getPrefs(context)
        prefs.edit()
            .putBoolean(KEY_IS_SCHEDULED, false)
            .putLong(KEY_SCHEDULED_TIME_MILLIS, 0L)
            .apply()

        updateTile(context)
    }

    fun isScheduled(context: Context): Boolean {
        val prefs = getPrefs(context)
        val scheduled = prefs.getBoolean(KEY_IS_SCHEDULED, false)
        val triggerTime = prefs.getLong(KEY_SCHEDULED_TIME_MILLIS, 0L)
        if (scheduled && triggerTime > 0 && triggerTime < System.currentTimeMillis()) {
            // Already passed
            prefs.edit().putBoolean(KEY_IS_SCHEDULED, false).apply()
            return false
        }
        return scheduled
    }

    fun updateTile(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                TileService.requestListeningState(
                    context,
                    ComponentName(context, FakeCallTileService::class.java)
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "[FakeCall] Failed to request tile update: ${e.message}")
        }
    }
}
