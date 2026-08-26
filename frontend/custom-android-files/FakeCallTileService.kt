package com.nameisrk.aegiswomensafety

import android.graphics.drawable.Icon
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log
import android.widget.Toast
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class FakeCallTileService : TileService() {

    companion object {
        private const val TAG = "FakeCallTileService"
    }

    override fun onStartListening() {
        super.onStartListening()
        updateTileState()
    }

    private fun updateTileState() {
        val tile = qsTile ?: return
        val isScheduled = FakeCallScheduler.isScheduled(this)

        if (isScheduled) {
            tile.state = Tile.STATE_ACTIVE
            tile.label = "Fake Call Scheduled"
        } else {
            tile.state = Tile.STATE_INACTIVE
            tile.label = "Fake Call"
        }

        try {
            // Match our app launcher icon
            tile.icon = Icon.createWithResource(this, R.mipmap.ic_launcher)
        } catch (e: Exception) {
            // Fallback
        }

        tile.updateTile()
    }

    override fun onClick() {
        super.onClick()
        Log.d(TAG, "[FakeCall] Quick Settings Tile clicked")

        val isScheduled = FakeCallScheduler.isScheduled(this)

        if (isScheduled) {
            // User taps active tile -> Cancel scheduled fake call
            FakeCallScheduler.cancel(this)
            Toast.makeText(this, "🛡️ Fake Call cancelled", Toast.LENGTH_SHORT).show()
            updateTileState()
        } else {
            // Read saved native config and schedule
            val prefs = FakeCallScheduler.getPrefs(this)
            val delaySeconds = prefs.getInt(FakeCallScheduler.KEY_DELAY_SECONDS, 0)
            val callerName = prefs.getString(FakeCallScheduler.KEY_CALLER_NAME, "Mom") ?: "Mom"

            Log.d(TAG, "[FakeCall] Tile triggering with caller=$callerName, delaySeconds=$delaySeconds")

            if (delaySeconds <= 0) {
                Toast.makeText(this, "🛡️ Incoming Fake Call from $callerName...", Toast.LENGTH_SHORT).show()
                FakeCallScheduler.schedule(this, 0)
            } else {
                FakeCallScheduler.schedule(this, delaySeconds)
                val delayText = if (delaySeconds >= 60) "${delaySeconds / 60}m" else "${delaySeconds}s"
                Toast.makeText(this, "🛡️ Fake Call scheduled in $delayText ($callerName)", Toast.LENGTH_SHORT).show()
                updateTileState()
            }
        }
    }
}
