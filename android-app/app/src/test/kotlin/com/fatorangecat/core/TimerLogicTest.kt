package com.fatorangecat.core

import com.fatorangecat.core.TimerLogic.Phase
import com.fatorangecat.core.TimerLogic.Settings
import com.fatorangecat.core.TimerLogic.TimerState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

private const val EPS = 1e-6

private fun approx(a: Double, b: Double, eps: Double = EPS, msg: String = "") {
    assertTrue("$msg |$a - $b| > $eps", kotlin.math.abs(a - b) <= eps)
}

class TimerLogicTest {

    // ---- formatMMSS ----

    @Test
    fun formatMMSS_padsSeconds() {
        assertEquals("0:00", TimerLogic.formatMMSS(0))
        assertEquals("0:05", TimerLogic.formatMMSS(5))
        assertEquals("1:05", TimerLogic.formatMMSS(65))
        assertEquals("5:00", TimerLogic.formatMMSS(300))
    }

    @Test
    fun formatMMSS_clampsNegativesToZero() {
        assertEquals("0:00", TimerLogic.formatMMSS(-10))
    }

    // ---- clampWorkMinutes ----

    @Test
    fun clampWorkMinutes_enforcesBounds() {
        assertEquals(25, TimerLogic.clampWorkMinutes(25))
        assertEquals(1, TimerLogic.clampWorkMinutes(0))
        assertEquals(1, TimerLogic.clampWorkMinutes(-7))
        assertEquals(120, TimerLogic.clampWorkMinutes(9999))
        assertEquals(45, TimerLogic.clampWorkMinutes("45"))
    }

    @Test
    fun clampWorkMinutes_fallsBackOnGarbage() {
        assertEquals(TimerLogic.DEFAULT_WORK_MINUTES, TimerLogic.clampWorkMinutes("nope"))
        assertEquals(TimerLogic.DEFAULT_WORK_MINUTES, TimerLogic.clampWorkMinutes(Double.NaN))
    }

    // ---- weightStageForHours ----

    @Test
    fun weightStages_matchTheSpec() {
        assertEquals(0, TimerLogic.weightStageForHours(0.0).stage)
        assertEquals(0, TimerLogic.weightStageForHours(0.99).stage)
        assertEquals(1, TimerLogic.weightStageForHours(1.0).stage)
        assertEquals(2, TimerLogic.weightStageForHours(2.0).stage)
        // hour 3 -> takes ~half the screen
        assertEquals(3, TimerLogic.weightStageForHours(3.0).stage)
        assertTrue(TimerLogic.weightStageForHours(3.0).sizeFactor >= 0.5)
        // hour 5 -> can barely see the code
        assertEquals(4, TimerLogic.weightStageForHours(5.0).stage)
        assertTrue(TimerLogic.weightStageForHours(5.0).sizeFactor >= 0.8)
    }

    @Test
    fun weightStages_monotonicallyNonDecreasing() {
        var prev = 0.0
        for (h in listOf(0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 8.0)) {
            val f = TimerLogic.weightStageForHours(h).sizeFactor
            assertTrue("regressed at h=$h", f >= prev)
            prev = f
        }
    }

    // ---- stretchFactor ----

    @Test
    fun stretchFactor_opensFrom1to1_6Across13Seconds() {
        val breakSec = 300
        approx(TimerLogic.stretchFactor(300, breakSec), 1.0)
        approx(TimerLogic.stretchFactor(287, breakSec), 1.6)
        // halfway through the 13s window
        approx(TimerLogic.stretchFactor(294, breakSec), 1.0 + (6.0 / 13.0) * 0.6)
    }

    @Test
    fun stretchFactor_staysAt1_6AfterTheCatIsComfortable() {
        approx(TimerLogic.stretchFactor(200, 300), 1.6)
        approx(TimerLogic.stretchFactor(0, 300), 1.6)
    }

    // ---- remainingSeconds ----

    @Test
    fun remainingSeconds_computesCeilOfPhaseDelta() {
        val now = 1_000_000L
        val state = TimerState(phase = Phase.BREAK, phaseEndsAt = now + 4500L)
        assertEquals(5, TimerLogic.remainingSeconds(state, now))
    }

    @Test
    fun remainingSeconds_floorsAtZeroOnceElapsed() {
        val now = 1_000_000L
        val state = TimerState(phase = Phase.BREAK, phaseEndsAt = now - 1000L)
        assertEquals(0, TimerLogic.remainingSeconds(state, now))
    }

    @Test
    fun remainingSeconds_returnsZeroWhenIdle() {
        assertEquals(0, TimerLogic.remainingSeconds(TimerState(phase = Phase.IDLE), 1L))
    }

    // ---- continuousWorkHours ----

    @Test
    fun continuousWorkHours_countsFromStreakStart() {
        val start = 0L
        val oneHour = 60L * 60L * 1000L
        approx(TimerLogic.continuousWorkHours(start, oneHour), 1.0)
        approx(TimerLogic.continuousWorkHours(start, 3L * oneHour), 3.0)
    }

    @Test
    fun continuousWorkHours_isZeroWhenNoStreak() {
        assertEquals(0.0, TimerLogic.continuousWorkHours(null, System.currentTimeMillis()), 0.0)
    }

    // ---- advancePhase ----

    @Test
    fun advancePhase_fromIdleStartsAWorkBlock() {
        val now = 1_000_000L
        val next = TimerLogic.advancePhase(
            TimerState(phase = Phase.IDLE, phaseEndsAt = 0L, workStreakStartedAt = null),
            Settings(workMinutes = 25),
            now,
        )
        assertEquals(Phase.WORK, next.phase)
        assertEquals(now + 25L * 60L * 1000L, next.phaseEndsAt)
        assertEquals(now, next.workStreakStartedAt)
    }

    @Test
    fun advancePhase_fromWorkTransitionsToBreakAndPreservesStreak() {
        val streakStart = 1_000_000L
        val now = streakStart + 25L * 60L * 1000L
        val next = TimerLogic.advancePhase(
            TimerState(phase = Phase.WORK, phaseEndsAt = now, workStreakStartedAt = streakStart),
            Settings(workMinutes = 25),
            now,
        )
        assertEquals(Phase.BREAK, next.phase)
        assertEquals(now + 5L * 60L * 1000L, next.phaseEndsAt)
        assertEquals("streak must persist into break", streakStart, next.workStreakStartedAt)
        assertEquals(now, next.breakStartedAt)
    }

    @Test
    fun advancePhase_fromBreakResetsStreak_theOnlyWayToShrinkTheCat() {
        val streakStart = 0L
        val breakEnd = streakStart + 30L * 60L * 1000L
        val next = TimerLogic.advancePhase(
            TimerState(phase = Phase.BREAK, phaseEndsAt = breakEnd, workStreakStartedAt = streakStart),
            Settings(workMinutes = 25),
            breakEnd,
        )
        assertEquals(Phase.WORK, next.phase)
        assertEquals(
            "streak must reset after a completed break",
            breakEnd,
            next.workStreakStartedAt,
        )
    }

    @Test
    fun advancePhase_respectsCustomWorkMinutes() {
        val now = 0L
        val next = TimerLogic.advancePhase(
            TimerState(phase = Phase.IDLE),
            Settings(workMinutes = 50),
            now,
        )
        assertEquals(50L * 60L * 1000L, next.phaseEndsAt)
    }

    @Test
    fun advancePhase_clampsAbsurdWorkMinutes() {
        val now = 0L
        val tooBig = TimerLogic.advancePhase(
            TimerState(phase = Phase.IDLE),
            Settings(workMinutes = 100_000),
            now,
        )
        assertEquals(TimerLogic.MAX_WORK_MINUTES * 60L * 1000L, tooBig.phaseEndsAt)
        val tooSmall = TimerLogic.advancePhase(
            TimerState(phase = Phase.IDLE),
            Settings(workMinutes = 0),
            now,
        )
        assertEquals(TimerLogic.MIN_WORK_MINUTES * 60L * 1000L, tooSmall.phaseEndsAt)
    }

    // ---- shouldWarn ----

    @Test
    fun shouldWarn_firesOnlyInFinalWarningSecondsOfWork() {
        val now = 1_000_000L
        val justStarted = TimerState(phase = Phase.WORK, phaseEndsAt = now + 25L * 60L * 1000L)
        assertFalse(TimerLogic.shouldWarn(justStarted, now))

        val tightWindow = TimerState(phase = Phase.WORK, phaseEndsAt = now + 30L * 1000L)
        assertTrue(TimerLogic.shouldWarn(tightWindow, now))

        val oneSecondLeft = TimerState(phase = Phase.WORK, phaseEndsAt = now + 999L)
        assertTrue(TimerLogic.shouldWarn(oneSecondLeft, now))

        val justEnded = TimerState(phase = Phase.WORK, phaseEndsAt = now)
        assertFalse(TimerLogic.shouldWarn(justEnded, now))
    }

    @Test
    fun shouldWarn_neverFiresDuringBreakOrIdle() {
        val now = 1_000_000L
        assertFalse(
            TimerLogic.shouldWarn(
                TimerState(phase = Phase.BREAK, phaseEndsAt = now + 15L * 1000L),
                now,
            ),
        )
        assertFalse(TimerLogic.shouldWarn(TimerState(phase = Phase.IDLE, phaseEndsAt = 0L), now))
    }

    @Test
    fun warningSeconds_isExposedAndSane() {
        assertTrue(TimerLogic.WARNING_SECONDS in 1..120)
    }

    // ---- Scenarios (end-to-end behavior pinned to spec) ----

    @Test
    fun scenario_fiveHoursOfUnbrokenWorkLandsInEclipse() {
        val t0 = 0L
        val state = TimerLogic.advancePhase(
            TimerState(phase = Phase.IDLE),
            Settings(workMinutes = 25),
            t0,
        )
        // Pretend the user keeps cancelling breaks (they can't — but this
        // simulates the streak logic if the break never *completes*).
        val fiveHours = 5L * 60L * 60L * 1000L
        val hours = TimerLogic.continuousWorkHours(state.workStreakStartedAt, t0 + fiveHours)
        val weight = TimerLogic.weightStageForHours(hours)
        assertEquals(4, weight.stage)
        assertEquals("eclipse", weight.label)
    }

    @Test
    fun scenario_countdownHitsZeroExactlyAtPhaseEndsAt() {
        val phaseEndsAt = 1_700_000_000_000L
        val state = TimerState(phase = Phase.BREAK, phaseEndsAt = phaseEndsAt)
        assertEquals("0:00", TimerLogic.formatMMSS(TimerLogic.remainingSeconds(state, phaseEndsAt)))
        assertEquals(
            "0:01",
            TimerLogic.formatMMSS(TimerLogic.remainingSeconds(state, phaseEndsAt - 1000L)),
        )
    }

    @Test
    fun scenario_forceBreakStartsBreakAndPreservesStreak() {
        // Mirrors the FORCE_BREAK / "Summon him now" code path in
        // background.js / TimerService.handleForceBreak: pretend we're
        // in WORK and advance.
        val streakStart = 1_000_000L
        val now = streakStart + 7L * 60L * 1000L // 7 minutes into the work block
        val current = TimerState(
            phase = Phase.WORK,
            phaseEndsAt = streakStart + 25L * 60L * 1000L,
            workStreakStartedAt = streakStart,
        )
        val next = TimerLogic.advancePhase(
            current.copy(phase = Phase.WORK),
            Settings(workMinutes = 25),
            now,
        )
        assertEquals(Phase.BREAK, next.phase)
        assertEquals(now + TimerLogic.BREAK_MINUTES * 60L * 1000L, next.phaseEndsAt)
        assertEquals(
            "force-break must NOT reset the streak — only completing the break does",
            streakStart,
            next.workStreakStartedAt,
        )
    }

    @Test
    fun scenario_forceBreakFromIdleInitializesStreakToNow() {
        val now = 5_000_000L
        val next = TimerLogic.advancePhase(
            TimerState(phase = Phase.IDLE).copy(phase = Phase.WORK),
            Settings(workMinutes = 25),
            now,
        )
        assertEquals(Phase.BREAK, next.phase)
        assertEquals(
            "force-break from idle must seed the streak so weight starts at 0",
            now,
            next.workStreakStartedAt,
        )
    }

    @Test
    fun scenario_breakCompletionIsTheOnlyPathToResetWeight() {
        val t0 = 0L
        val streakStart = t0
        val fourHours = 4L * 60L * 60L * 1000L
        val beforeBreak = TimerLogic.weightStageForHours(
            TimerLogic.continuousWorkHours(streakStart, t0 + fourHours),
        )
        assertEquals(3, beforeBreak.stage)

        val afterBreak = TimerLogic.advancePhase(
            TimerState(
                phase = Phase.BREAK,
                phaseEndsAt = t0 + fourHours + 5L * 60L * 1000L,
                workStreakStartedAt = streakStart,
            ),
            Settings(workMinutes = 25),
            t0 + fourHours + 5L * 60L * 1000L,
        )
        val newWeight = TimerLogic.weightStageForHours(
            TimerLogic.continuousWorkHours(
                afterBreak.workStreakStartedAt,
                afterBreak.workStreakStartedAt!!,
            ),
        )
        assertEquals(0, newWeight.stage)
    }
}
