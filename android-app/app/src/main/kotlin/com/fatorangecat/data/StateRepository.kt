package com.fatorangecat.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.fatorangecat.core.TimerLogic.Phase
import com.fatorangecat.core.TimerLogic.TimerState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.stateDataStore by preferencesDataStore(name = "timer_state")

// Persists the timer state across process death so the foreground service
// can recover after a force-stop or low-memory kill. Sole writer is the
// TimerService; readers (MainActivity, CatOverlayService) observe.
class StateRepository(private val context: Context) {

    val flow: Flow<TimerState> = context.stateDataStore.data.map { prefs ->
        val phase = prefs[KEY_PHASE]?.let(::phaseFromString) ?: Phase.IDLE
        TimerState(
            phase = phase,
            phaseEndsAt = prefs[KEY_PHASE_ENDS_AT] ?: 0L,
            workStreakStartedAt = prefs[KEY_WORK_STREAK_STARTED_AT].takeIf { it != 0L },
            breakStartedAt = prefs[KEY_BREAK_STARTED_AT].takeIf { it != 0L },
        )
    }

    suspend fun current(): TimerState = flow.first()

    suspend fun set(state: TimerState) {
        context.stateDataStore.edit { prefs ->
            prefs[KEY_PHASE] = state.phase.name
            prefs[KEY_PHASE_ENDS_AT] = state.phaseEndsAt
            prefs[KEY_WORK_STREAK_STARTED_AT] = state.workStreakStartedAt ?: 0L
            prefs[KEY_BREAK_STARTED_AT] = state.breakStartedAt ?: 0L
        }
    }

    private fun phaseFromString(name: String): Phase = try {
        Phase.valueOf(name)
    } catch (_: IllegalArgumentException) {
        Phase.IDLE
    }

    private companion object {
        val KEY_PHASE = stringPreferencesKey("phase")
        val KEY_PHASE_ENDS_AT = longPreferencesKey("phase_ends_at")
        val KEY_WORK_STREAK_STARTED_AT = longPreferencesKey("work_streak_started_at")
        val KEY_BREAK_STARTED_AT = longPreferencesKey("break_started_at")
    }
}
