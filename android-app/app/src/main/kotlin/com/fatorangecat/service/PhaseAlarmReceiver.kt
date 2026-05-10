package com.fatorangecat.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

// AlarmManager fires this; it forwards to TimerService so the service can
// keep all state-mutation logic in one place.
class PhaseAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val forward = Intent(context, TimerService::class.java).apply {
            action = TimerService.ACTION_PHASE_END
        }
        ContextCompat.startForegroundService(context, forward)
    }
}
