package com.nameisrk.aegiswomensafety

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class FakeCallModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "FakeCallModule"
        var instance: FakeCallModule? = null
    }

    init {
        instance = this
    }

    override fun getName(): String {
        return "FakeCallModule"
    }

    @ReactMethod
    fun saveNativeConfig(config: ReadableMap, promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = FakeCallScheduler.getPrefs(context)
            val editor = prefs.edit()

            if (config.hasKey("callerName")) {
                editor.putString(FakeCallScheduler.KEY_CALLER_NAME, config.getString("callerName"))
            }
            if (config.hasKey("phoneNumber")) {
                editor.putString(FakeCallScheduler.KEY_PHONE_NUMBER, config.getString("phoneNumber"))
            }
            if (config.hasKey("ringtone")) {
                editor.putString(FakeCallScheduler.KEY_RINGTONE, config.getString("ringtone"))
            }
            if (config.hasKey("vibrate")) {
                editor.putBoolean(FakeCallScheduler.KEY_VIBRATE, config.getBoolean("vibrate"))
            }
            if (config.hasKey("autoPlayVoice")) {
                editor.putBoolean(FakeCallScheduler.KEY_AUTO_PLAY_VOICE, config.getBoolean("autoPlayVoice"))
            }
            if (config.hasKey("delaySeconds")) {
                editor.putInt(FakeCallScheduler.KEY_DELAY_SECONDS, config.getInt("delaySeconds"))
            }
            if (config.hasKey("enabled")) {
                editor.putBoolean(FakeCallScheduler.KEY_ENABLED, config.getBoolean("enabled"))
            }

            editor.apply()
            Log.d(TAG, "[FakeCall] Native config saved successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "[FakeCall] Failed to save native config: ${e.message}", e)
            promise.reject("SAVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getNativeConfig(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = FakeCallScheduler.getPrefs(context)
            val map = Arguments.createMap().apply {
                putString("callerName", prefs.getString(FakeCallScheduler.KEY_CALLER_NAME, "Mom"))
                putString("phoneNumber", prefs.getString(FakeCallScheduler.KEY_PHONE_NUMBER, "+91 98765 43210"))
                putString("ringtone", prefs.getString(FakeCallScheduler.KEY_RINGTONE, "Marimba"))
                putBoolean("vibrate", prefs.getBoolean(FakeCallScheduler.KEY_VIBRATE, true))
                putBoolean("autoPlayVoice", prefs.getBoolean(FakeCallScheduler.KEY_AUTO_PLAY_VOICE, true))
                putInt("delaySeconds", prefs.getInt(FakeCallScheduler.KEY_DELAY_SECONDS, 0))
                putBoolean("isScheduled", FakeCallScheduler.isScheduled(context))
                putBoolean("enabled", prefs.getBoolean(FakeCallScheduler.KEY_ENABLED, true))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message)
        }
    }

    @ReactMethod
    fun scheduleFakeCall(delaySeconds: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            FakeCallScheduler.schedule(context, delaySeconds)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelScheduledFakeCall(promise: Promise) {
        try {
            val context = reactApplicationContext
            FakeCallScheduler.cancel(context)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message)
        }
    }

    @ReactMethod
    fun triggerImmediateFakeCall(promise: Promise) {
        try {
            val context = reactApplicationContext
            FakeCallBroadcastReceiver.triggerFakeCall(context)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TRIGGER_ERROR", e.message)
        }
    }
}
