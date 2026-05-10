package com.fatorangecat

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.fatorangecat.data.AppContainer

class CatApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java) ?: return

        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_TIMER,
                getString(R.string.timer_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.timer_channel_description)
                setShowBadge(false)
            },
        )

        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_WARNING,
                getString(R.string.warning_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = getString(R.string.warning_channel_description)
                setShowBadge(false)
            },
        )
    }

    companion object {
        const val CHANNEL_TIMER = "timer"
        const val CHANNEL_WARNING = "warning"
        const val NOTIFICATION_TIMER = 1
        const val NOTIFICATION_WARNING = 2
    }
}
