package com.nameisrk.aegiswomensafety

import android.app.Activity
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat

class FakeCallActivity : Activity() {

    companion object {
        private const val TAG = "FakeCallActivity"
        const val EXTRA_CALLER_NAME = "extra_caller_name"
        const val EXTRA_PHONE_NUMBER = "extra_phone_number"
        const val EXTRA_RINGTONE = "extra_ringtone"
        const val EXTRA_VIBRATE = "extra_vibrate"
        private const val CHANNEL_ID = "fake_call_channel_v1"

        fun start(
            context: Context,
            callerName: String,
            phoneNumber: String,
            ringtone: String,
            vibrate: Boolean
        ) {
            val intent = Intent(context, FakeCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra(EXTRA_CALLER_NAME, callerName)
                putExtra(EXTRA_PHONE_NUMBER, phoneNumber)
                putExtra(EXTRA_RINGTONE, ringtone)
                putExtra(EXTRA_VIBRATE, vibrate)
            }

            try {
                context.startActivity(intent)
            } catch (e: Exception) {
                Log.w(TAG, "[FakeCall] Direct activity start failed, posting full-screen notification fallback: ${e.message}")
                postFullScreenNotification(context, intent, callerName)
            }
        }

        private fun postFullScreenNotification(context: Context, fullScreenIntent: Intent, callerName: String) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Fake Call Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Incoming Fake Call Notifications"
                    enableLights(true)
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(channel)
            }

            val pendingIntent = PendingIntent.getActivity(
                context,
                4402,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setContentTitle("Incoming Call")
                .setContentText(callerName)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pendingIntent, true)
                .setAutoCancel(true)

            notificationManager.notify(4402, builder.build())
        }
    }

    private var ringtonePlayer: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var isCallActive = false
    private var callDurationSeconds = 0
    private val handler = Handler(Looper.getMainLooper())
    private var timerRunnable: Runnable? = null

    private lateinit var txtCallerName: TextView
    private lateinit var txtPhoneNumber: TextView
    private lateinit var txtCallStatus: TextView
    private lateinit var incomingActionsLayout: LinearLayout
    private lateinit var activeActionsLayout: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "[FakeCall] FakeCallActivity onCreate")

        setupWindowFlags()

        val callerName = intent.getStringExtra(EXTRA_CALLER_NAME) ?: "Mom"
        val phoneNumber = intent.getStringExtra(EXTRA_PHONE_NUMBER) ?: "+91 98765 43210"
        val ringtoneName = intent.getStringExtra(EXTRA_RINGTONE) ?: "Marimba"
        val shouldVibrate = intent.getBooleanExtra(EXTRA_VIBRATE, true)

        buildUI(callerName, phoneNumber)

        if (shouldVibrate) {
            startVibration()
        }
        startRingtone(ringtoneName)
    }

    private fun setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            keyguardManager?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.statusBarColor = Color.parseColor("#0F172A")
    }

    private fun buildUI(callerName: String, phoneNumber: String) {
        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0F172A")) // Deep modern dark background
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(48, 96, 48, 96)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Top Tag
        val appTag = TextView(this).apply {
            text = "🛡️ AEGIS SAFETY INCOMING CALL"
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        }
        rootLayout.addView(appTag)

        // Caller Avatar Circle
        val avatarCircle = FrameLayout(this).apply {
            val size = dpToPx(110)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                bottomMargin = dpToPx(24)
            }
            setBackgroundColor(Color.parseColor("#1E293B"))
        }
        val avatarText = TextView(this).apply {
            text = callerName.take(1).uppercase()
            setTextColor(Color.parseColor("#8B5CF6"))
            textSize = 40f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        avatarCircle.addView(avatarText)
        rootLayout.addView(avatarCircle)

        // Caller Name
        txtCallerName = TextView(this).apply {
            text = callerName
            setTextColor(Color.WHITE)
            textSize = 28f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(6) }
        }
        rootLayout.addView(txtCallerName)

        // Phone Number
        txtPhoneNumber = TextView(this).apply {
            text = phoneNumber
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 15f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(12) }
        }
        rootLayout.addView(txtPhoneNumber)

        // Call Status
        txtCallStatus = TextView(this).apply {
            text = "Incoming Call..."
            setTextColor(Color.parseColor("#C084FC"))
            textSize = 16f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(48) }
        }
        rootLayout.addView(txtCallStatus)

        // Space weight
        val spacer = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, 0, 1f)
        }
        rootLayout.addView(spacer)

        // Incoming Call Action Buttons (Decline & Accept)
        incomingActionsLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val btnDecline = Button(this).apply {
            text = "✕ Decline"
            setBackgroundColor(Color.parseColor("#EF4444"))
            setTextColor(Color.WHITE)
            textSize = 15f
            layoutParams = LinearLayout.LayoutParams(0, dpToPx(56), 1f).apply {
                rightMargin = dpToPx(12)
            }
            setOnClickListener {
                endCall()
            }
        }
        incomingActionsLayout.addView(btnDecline)

        val btnAccept = Button(this).apply {
            text = "✓ Accept"
            setBackgroundColor(Color.parseColor("#10B981"))
            setTextColor(Color.WHITE)
            textSize = 15f
            layoutParams = LinearLayout.LayoutParams(0, dpToPx(56), 1f).apply {
                leftMargin = dpToPx(12)
            }
            setOnClickListener {
                acceptCall()
            }
        }
        incomingActionsLayout.addView(btnAccept)
        rootLayout.addView(incomingActionsLayout)

        // Active Call Controls (End Call)
        activeActionsLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val btnEndCall = Button(this).apply {
            text = "End Call"
            setBackgroundColor(Color.parseColor("#EF4444"))
            setTextColor(Color.WHITE)
            textSize = 16f
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dpToPx(56)
            )
            setOnClickListener {
                endCall()
            }
        }
        activeActionsLayout.addView(btnEndCall)
        rootLayout.addView(activeActionsLayout)

        setContentView(rootLayout)
    }

    private fun acceptCall() {
        isCallActive = true
        stopRingtone()
        stopVibration()

        txtCallStatus.text = "00:00"
        txtCallStatus.setTextColor(Color.parseColor("#10B981"))

        incomingActionsLayout.visibility = View.GONE
        activeActionsLayout.visibility = View.VISIBLE

        timerRunnable = object : Runnable {
            override fun run() {
                if (!isCallActive) return
                callDurationSeconds++
                val mins = callDurationSeconds / 60
                val secs = callDurationSeconds % 60
                txtCallStatus.text = String.format("%02d:%02d", mins, secs)
                handler.postDelayed(this, 1000L)
            }
        }
        handler.postDelayed(timerRunnable!!, 1000L)
    }

    private fun endCall() {
        isCallActive = false
        stopRingtone()
        stopVibration()
        timerRunnable?.let { handler.removeCallbacks(it) }
        finish()
    }

    private fun startRingtone(ringtoneName: String) {
        if (ringtoneName.equals("Silent", ignoreCase = true)) return

        try {
            val alertUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            ringtonePlayer = RingtoneManager.getRingtone(applicationContext, alertUri)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                ringtonePlayer?.audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            }
            ringtonePlayer?.play()
        } catch (e: Exception) {
            Log.e(TAG, "[FakeCall] Ringtone error: ${e.message}")
        }
    }

    private fun stopRingtone() {
        try {
            ringtonePlayer?.stop()
            ringtonePlayer = null
        } catch (e: Exception) {
            // Ignore
        }
    }

    private fun startVibration() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            val pattern = longArrayOf(0, 1000, 1000)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            Log.e(TAG, "[FakeCall] Vibration error: ${e.message}")
        }
    }

    private fun stopVibration() {
        try {
            vibrator?.cancel()
            vibrator = null
        } catch (e: Exception) {
            // Ignore
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopRingtone()
        stopVibration()
        timerRunnable?.let { handler.removeCallbacks(it) }
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }
}
