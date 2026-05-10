package com.fatorangecat.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.fatorangecat.data.appContainer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

// On reboot, re-arm the timer if the user had it enabled. Keeps the cat
// faithful to its promise — disabling is the only way out.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) return

        val pending = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                val settings = context.appContainer.settings.current()
                if (settings.enabled) TimerService.start(context)
            } finally {
                pending.finish()
            }
        }
    }
}
