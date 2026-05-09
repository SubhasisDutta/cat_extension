package com.fatorangecat.core

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Pure functions for the pomodoro state machine and weight system.
// Mirrors chrome-extension/lib/timer-logic.js line-for-line. No Android
// dependencies — runnable on plain JVM JUnit.

object TimerLogic {

    const val DEFAULT_WORK_MINUTES: Int = 25
    const val BREAK_MINUTES: Int = 5
    const val MIN_WORK_MINUTES: Int = 1
    const val MAX_WORK_MINUTES: Int = 120
    const val WARNING_SECONDS: Int = 30

    enum class Phase { IDLE, WORK, BREAK }

    data class TimerState(
        val phase: Phase,
        val phaseEndsAt: Long = 0L,
        val workStreakStartedAt: Long? = null,
        val breakStartedAt: Long? = null,
    )

    data class Settings(val workMinutes: Any?)

    data class WeightStage(val stage: Int, val sizeFactor: Double, val label: String)

    fun weightStageForHours(hours: Double): WeightStage {
        if (hours < 1.0) return WeightStage(0, 0.22, "smug")
        if (hours < 2.0) return WeightStage(1, 0.32, "chunky")
        if (hours < 3.0) return WeightStage(2, 0.45, "rotund")
        if (hours < 5.0) return WeightStage(3, 0.60, "obscene")
        return WeightStage(4, 0.85, "eclipse")
    }

    fun stretchFactor(secondsRemaining: Int, breakSeconds: Int): Double {
        val totalStretchWindow = 13
        val elapsed = breakSeconds - secondsRemaining
        if (elapsed <= 0) return 1.0
        if (elapsed >= totalStretchWindow) return 1.6
        return 1.0 + (elapsed.toDouble() / totalStretchWindow) * 0.6
    }

    fun clampWorkMinutes(input: Any?): Int {
        val asDouble: Double = when (input) {
            is Number -> input.toDouble()
            is String -> input.toDoubleOrNull() ?: return DEFAULT_WORK_MINUTES
            else -> return DEFAULT_WORK_MINUTES
        }
        if (asDouble.isNaN() || asDouble.isInfinite()) return DEFAULT_WORK_MINUTES
        val floored = floor(asDouble).toInt()
        return min(MAX_WORK_MINUTES, max(MIN_WORK_MINUTES, floored))
    }

    fun formatMMSS(seconds: Number): String {
        val s = max(0, floor(seconds.toDouble()).toInt())
        val m = s / 60
        val r = s % 60
        return "$m:${r.toString().padStart(2, '0')}"
    }

    fun remainingSeconds(state: TimerState, nowMs: Long): Int {
        if (state.phase == Phase.IDLE) return 0
        val delta = state.phaseEndsAt - nowMs
        return max(0, ceil(delta / 1000.0).toInt())
    }

    fun shouldWarn(state: TimerState, nowMs: Long): Boolean {
        if (state.phase != Phase.WORK) return false
        val r = remainingSeconds(state, nowMs)
        return r in 1..WARNING_SECONDS
    }

    fun continuousWorkHours(workStreakStartedAt: Long?, nowMs: Long): Double {
        if (workStreakStartedAt == null) return 0.0
        return max(0.0, (nowMs - workStreakStartedAt) / (1000.0 * 60.0 * 60.0))
    }

    fun advancePhase(state: TimerState, settings: Settings, nowMs: Long): TimerState {
        val workMs = clampWorkMinutes(settings.workMinutes) * 60L * 1000L
        val breakMs = BREAK_MINUTES * 60L * 1000L
        return when (state.phase) {
            Phase.WORK -> {
                val streak = state.workStreakStartedAt ?: nowMs
                TimerState(
                    phase = Phase.BREAK,
                    phaseEndsAt = nowMs + breakMs,
                    workStreakStartedAt = streak,
                    breakStartedAt = nowMs,
                )
            }
            Phase.BREAK -> TimerState(
                phase = Phase.WORK,
                phaseEndsAt = nowMs + workMs,
                workStreakStartedAt = nowMs,
                breakStartedAt = null,
            )
            Phase.IDLE -> TimerState(
                phase = Phase.WORK,
                phaseEndsAt = nowMs + workMs,
                workStreakStartedAt = nowMs,
                breakStartedAt = null,
            )
        }
    }
}
