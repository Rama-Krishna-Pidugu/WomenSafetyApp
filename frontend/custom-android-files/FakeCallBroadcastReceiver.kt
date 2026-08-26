package com.nameisrk.aegiswomensafety

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log

class FakeCallBroadcastReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "FakeCallReceiver"
        const val ACTION_TRIGGER_FAKE_CALL = "com.nameisrk.aegiswomensafety.ACTION_TRIGGER_FAKE_CALL"

        fun triggerFakeCall(context: Context) {
            Log.d(TAG, "[FakeCall] Triggering fake incoming call activity directly")
            val prefs = FakeCallScheduler.getPrefs(context)
            val callerName = prefs.getString(FakeCallScheduler.KEY_CALLER_NAME, "Mom") ?: "Mom"
            val phoneNumber = prefs.getString(FakeCallScheduler.KEY_PHONE_NUMBER, "+91 98765 43210") ?: "+91 98765 43210"
            val ringtone = prefs.getString(FakeCallScheduler.KEY_RINGTONE, "Marimba") ?: "Marimba"
            val vibrate = prefs.getBoolean(FakeCallScheduler.KEY_VIBRATE, true)

            // Reset scheduled state
            prefs.edit()
                .putBoolean(FakeCallScheduler.KEY_IS_SCHEDULED, false)
                .putLong(FakeCallScheduler.KEY_SCHEDULED_TIME_MILLIS, 0L)
                .apply()

            FakeCallScheduler.updateTile(context)

            FakeCallActivity.start(
                context = context,
                callerName = callerName,
                phoneNumber = phoneNumber,
                ringtone = ringtone,
                vibrate = vibrate
            )
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "[FakeCall] BroadcastReceiver received action: ${intent?.action}")

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "aegis:fake_call_wakelock"
        )
        wakeLock?.acquire(5000L) // 5 seconds wake lock

        try {
            triggerFakeCall(context)
        } finally {
            try {
                if (wakeLock?.isHeld == true) {
                    wakeLock.release()
                }
            } catch (e: Exception) {
                // Ignore
            }
        }
    }
}
