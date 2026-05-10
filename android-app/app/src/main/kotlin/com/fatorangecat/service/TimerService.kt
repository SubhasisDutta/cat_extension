package com.fatorangecat.service

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.fatorangecat.CatApplication
import com.fatorangecat.MainActivity
import com.fatorangecat.R
import com.fatorangecat.core.TimerLogic
import com.fatorangecat.core.TimerLogic.Phase
import com.fatorangecat.core.TimerLogic.TimerState
import com.fatorangecat.data.appContainer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

// Foreground service that owns the timer state machine. Mirrors the role of
// background.js in the Chrome extension:
//   - Reads/writes settings + state
//   - Schedules AlarmManager for phase boundaries (analogue of chrome.alarms)
//   - Starts/stops CatOverlayService when entering/leaving BREAK
//   - Maintains a foreground notification with the current phase + countdown
class TimerService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var tickerJob: Job? = null
    private val alarmManager by lazy { getSystemService(AlarmManager::class.java) }
    private val notificationManager by lazy { getSystemService(NotificationManager::class.java) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startInForeground(state = null)
        observeStateForOverlayAndNotification()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> handleStart()
            ACTION_PHASE_END -> handlePhaseEnd()
            ACTION_FORCE_BREAK -> handleForceBreak()
            ACTION_SETTINGS_CHANGED -> handleSettingsChanged()
            ACTION_STOP -> handleStop()
            else -> handleStart()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    // ---- handlers ----

    private fun handleStart() = scope.launch {
        val settings = appContainer.settings.current()
        if (!settings.enabled) {
            handleStop()
            return@launch
        }
        val now = System.currentTimeMillis()
        val state = appContainer.state.current()
        val resolved = when {
            // Fresh start, or stale state: kick off a work block.
            state.phase == Phase.IDLE -> TimerLogic.advancePhase(
                TimerState(phase = Phase.IDLE),
                TimerLogic.Settings(workMinutes = settings.workMinutes),
                now,
            )
            // Phase already elapsed while we were dead — advance immediately.
            now >= state.phaseEndsAt -> TimerLogic.advancePhase(
                state,
                TimerLogic.Settings(workMinutes = settings.workMinutes),
                now,
            )
            else -> state
        }
        appContainer.state.set(resolved)
        scheduleAlarmForPhaseEnd(resolved)
    }

    private fun handlePhaseEnd() = scope.launch {
        val settings = appContainer.settings.current()
        val now = System.currentTimeMillis()
        val current = appContainer.state.current()
        val next = TimerLogic.advancePhase(
            current,
            TimerLogic.Settings(workMinutes = settings.workMinutes),
            now,
        )
        appContainer.state.set(next)
        scheduleAlarmForPhaseEnd(next)
    }

    private fun handleForceBreak() = scope.launch {
        val now = System.currentTimeMillis()
        val current = appContainer.state.current()
        // Mirrors background.js: pretend we're in WORK and advance, which
        // produces BREAK while preserving (or initializing) the streak.
        val settings = appContainer.settings.current()
        val next = TimerLogic.advancePhase(
            current.copy(phase = Phase.WORK),
            TimerLogic.Settings(workMinutes = settings.workMinutes),
            now,
        )
        appContainer.state.set(next)
        scheduleAlarmForPhaseEnd(next)
    }

    private fun handleSettingsChanged() = scope.launch {
        // Don't interrupt the running phase; the new workMinutes value
        // applies to the *next* work block. This matches the extension.
        val settings = appContainer.settings.current()
        if (!settings.enabled) handleStop()
    }

    private fun handleStop() {
        cancelAlarm()
        scope.launch {
            appContainer.state.set(TimerState(phase = Phase.IDLE))
        }
        stopOverlay()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // ---- alarm scheduling ----

    private fun scheduleAlarmForPhaseEnd(state: TimerState) {
        cancelAlarm()
        if (state.phase == Phase.IDLE) return

        val triggerAt = state.phaseEndsAt
        val pi = phaseEndPendingIntent()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            // Fall back to inexact — better than nothing if user denied
            // SCHEDULE_EXACT_ALARM. MainActivity nudges them to grant it.
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        } else {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    private fun cancelAlarm() {
        alarmManager.cancel(phaseEndPendingIntent())
    }

    private fun phaseEndPendingIntent(): PendingIntent {
        val intent = Intent(this, PhaseAlarmReceiver::class.java).apply {
            action = ACTION_PHASE_END
        }
        return PendingIntent.getBroadcast(
            this,
            REQUEST_CODE_PHASE_END,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    // ---- foreground + ticking notification ----

    private fun startInForeground(state: TimerState?) {
        val notif = buildNotification(state)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                CatApplication.NOTIFICATION_TIMER,
                notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(CatApplication.NOTIFICATION_TIMER, notif)
        }
    }

    private fun buildNotification(state: TimerState?): android.app.Notification {
        val now = System.currentTimeMillis()
        val text = when (state?.phase) {
            null, Phase.IDLE -> getString(R.string.timer_notification_idle)
            Phase.WORK -> getString(
                R.string.timer_notification_work,
                TimerLogic.formatMMSS(TimerLogic.remainingSeconds(state, now)),
            )
            Phase.BREAK -> getString(
                R.string.timer_notification_break,
                TimerLogic.formatMMSS(TimerLogic.remainingSeconds(state, now)),
            )
        }
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val tapPi = PendingIntent.getActivity(
            this,
            0,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CatApplication.CHANNEL_TIMER)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_recent_history)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(tapPi)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun updateNotification(state: TimerState) {
        notificationManager.notify(CatApplication.NOTIFICATION_TIMER, buildNotification(state))
    }

    // Combine state + settings; whenever either changes, react.
    private fun observeStateForOverlayAndNotification() {
        scope.launch {
            appContainer.state.flow.combine(appContainer.settings.flow) { s, _ -> s }
                .collect { state ->
                    when (state.phase) {
                        Phase.BREAK -> startOverlay()
                        Phase.WORK, Phase.IDLE -> stopOverlay()
                    }
                    updateNotification(state)
                    restartTicker(state)
                }
        }
    }

    // The ticker refreshes the foreground notification every second and
    // posts the 30-second pre-break warning exactly once per work phase.
    // Phase transitions themselves are driven by AlarmManager — a missed
    // tick does not desync state.
    private fun restartTicker(state: TimerState) {
        tickerJob?.cancel()
        if (state.phase == Phase.IDLE) return
        tickerJob = scope.launch {
            var warningPosted = false
            while (true) {
                val now = System.currentTimeMillis()
                updateNotification(state)
                if (state.phase == Phase.WORK &&
                    !warningPosted &&
                    TimerLogic.shouldWarn(state, now)
                ) {
                    postWarningNotification(state, now)
                    warningPosted = true
                }
                val remaining = TimerLogic.remainingSeconds(state, now)
                if (remaining <= 0) break
                delay(1000)
            }
        }
    }

    private fun postWarningNotification(state: TimerState, now: Long) {
        val remainingText = TimerLogic.formatMMSS(TimerLogic.remainingSeconds(state, now))
        val tapIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val tapPi = PendingIntent.getActivity(
            this,
            1,
            tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notif = NotificationCompat.Builder(this, CatApplication.CHANNEL_WARNING)
            .setContentTitle(getString(R.string.warning_notification_title))
            .setContentText(getString(R.string.warning_notification_body, remainingText))
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(tapPi)
            .build()
        notificationManager.notify(CatApplication.NOTIFICATION_WARNING, notif)
    }

    // ---- overlay control ----

    private fun startOverlay() {
        val intent = Intent(this, CatOverlayService::class.java)
        ContextCompat.startForegroundService(this, intent)
    }

    private fun stopOverlay() {
        stopService(Intent(this, CatOverlayService::class.java))
    }

    companion object {
        const val ACTION_START = "com.fatorangecat.action.START"
        const val ACTION_STOP = "com.fatorangecat.action.STOP"
        const val ACTION_PHASE_END = "com.fatorangecat.action.PHASE_END"
        const val ACTION_FORCE_BREAK = "com.fatorangecat.action.FORCE_BREAK"
        const val ACTION_SETTINGS_CHANGED = "com.fatorangecat.action.SETTINGS_CHANGED"

        private const val REQUEST_CODE_PHASE_END = 100

        fun start(context: Context) {
            val intent = Intent(context, TimerService::class.java).apply {
                action = ACTION_START
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, TimerService::class.java).apply {
                action = ACTION_STOP
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun forceBreak(context: Context) {
            val intent = Intent(context, TimerService::class.java).apply {
                action = ACTION_FORCE_BREAK
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun notifySettingsChanged(context: Context) {
            val intent = Intent(context, TimerService::class.java).apply {
                action = ACTION_SETTINGS_CHANGED
            }
            ContextCompat.startForegroundService(context, intent)
        }
    }
}
