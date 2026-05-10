package com.fatorangecat

import android.Manifest
import android.app.AlarmManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import com.fatorangecat.core.TimerLogic.Phase
import com.fatorangecat.core.TimerLogic.TimerState
import com.fatorangecat.data.CatSettings
import com.fatorangecat.data.appContainer
import com.fatorangecat.service.TimerService
import com.fatorangecat.ui.PermissionFlags
import com.fatorangecat.ui.SettingsScreen
import com.fatorangecat.ui.SettingsScreenCallbacks
import com.fatorangecat.ui.theme.FatOrangeCatTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val overlayPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { _ -> /* permission state re-read on next composition tick */ }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) maybeStartService()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            FatOrangeCatTheme {
                val container = appContainer
                val settings by container.settings.flow
                    .collectAsStateWithLifecycle(initialValue = CatSettings())
                val state by container.state.flow
                    .collectAsStateWithLifecycle(initialValue = TimerState(phase = Phase.IDLE))

                // Tick a wall-clock state so the countdown updates while the
                // activity is in the foreground. Coarse 1s resolution matches
                // the overlay.
                var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }
                LaunchedEffect(Unit) {
                    while (true) {
                        nowMs = System.currentTimeMillis()
                        delay(1000)
                    }
                }

                // Permission flags re-checked on each `nowMs` tick — cheap and
                // means returning from the system permission screen reflects
                // the new state without needing a manual refresh.
                val permissions = remember(nowMs / 1000) {
                    PermissionFlags(
                        canDrawOverlays = Settings.canDrawOverlays(this@MainActivity),
                        canScheduleExactAlarms = canScheduleExactAlarmsCompat(),
                        canPostNotifications = hasNotificationPermission(),
                    )
                }

                SettingsScreen(
                    settings = settings,
                    state = state,
                    nowMs = nowMs,
                    permissions = permissions,
                    callbacks = SettingsScreenCallbacks(
                        onSaveWorkMinutes = ::saveWorkMinutes,
                        onToggleEnabled = ::toggleEnabled,
                        onSummonNow = ::summonNow,
                        onRequestOverlayPermission = ::requestOverlayPermission,
                        onRequestExactAlarmPermission = ::requestExactAlarmPermission,
                        onRequestNotificationPermission = ::requestNotificationPermission,
                    ),
                )
            }
        }

        maybeStartService()
    }

    // ---- callbacks ----

    private fun saveWorkMinutes(value: Int) {
        lifecycleScope.launch {
            appContainer.settings.setWorkMinutes(value)
            TimerService.notifySettingsChanged(this@MainActivity)
        }
    }

    private fun toggleEnabled(value: Boolean) {
        lifecycleScope.launch {
            appContainer.settings.setEnabled(value)
            if (value) TimerService.start(this@MainActivity)
            else TimerService.stop(this@MainActivity)
        }
    }

    private fun summonNow() {
        TimerService.forceBreak(this)
    }

    private fun requestOverlayPermission() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:$packageName"),
        )
        overlayPermissionLauncher.launch(intent)
    }

    private fun requestExactAlarmPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val intent = Intent(
            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
            Uri.parse("package:$packageName"),
        )
        startActivity(intent)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    // ---- helpers ----

    private fun maybeStartService() {
        lifecycleScope.launch {
            if (appContainer.settings.current().enabled) {
                TimerService.start(this@MainActivity)
            }
        }
    }

    private fun canScheduleExactAlarmsCompat(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val am = getSystemService(AlarmManager::class.java) ?: return false
        return am.canScheduleExactAlarms()
    }

    private fun hasNotificationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }
}
