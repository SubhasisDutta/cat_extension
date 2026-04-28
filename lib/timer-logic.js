// Pure functions for the pomodoro state machine and weight system.
// Kept dependency-free so they run in the service worker, content scripts,
// the popup, and the node test runner.

(function (root) {
  const DEFAULT_WORK_MINUTES = 25;
  const BREAK_MINUTES = 5;
  const MIN_WORK_MINUTES = 1;
  const MAX_WORK_MINUTES = 120;

  // Weight stages as a function of continuous work hours.
  // A "stage" determines how much of the screen the cat occupies.
  // Stage maps to a viewport-relative size factor (0.20 = 20% of min(vw,vh)).
  function weightStageForHours(hours) {
    if (hours < 1) return { stage: 0, sizeFactor: 0.22, label: "smug" };
    if (hours < 2) return { stage: 1, sizeFactor: 0.32, label: "chunky" };
    if (hours < 3) return { stage: 2, sizeFactor: 0.45, label: "rotund" };
    if (hours < 5) return { stage: 3, sizeFactor: 0.60, label: "obscene" };
    return { stage: 4, sizeFactor: 0.85, label: "eclipse" };
  }

  // Stretch factor during the break window. At 5:00 the cat is compact;
  // it stretches out as the break ticks down to 4:47 (the "getting comfortable" arc).
  // After 4:47 it stays stretched for the rest of the break.
  function stretchFactor(secondsRemaining, breakSeconds) {
    const totalStretchWindow = 13; // 5:00 -> 4:47
    const elapsed = breakSeconds - secondsRemaining;
    if (elapsed <= 0) return 1.0;
    if (elapsed >= totalStretchWindow) return 1.6;
    return 1.0 + (elapsed / totalStretchWindow) * 0.6;
  }

  function clampWorkMinutes(n) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return DEFAULT_WORK_MINUTES;
    return Math.min(MAX_WORK_MINUTES, Math.max(MIN_WORK_MINUTES, v));
  }

  function formatMMSS(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  // Compute remaining seconds in the current phase given a timestamp.
  // state: { phase: 'work'|'break'|'idle', phaseEndsAt: epochMs }
  function remainingSeconds(state, nowMs) {
    if (!state || state.phase === "idle") return 0;
    return Math.max(0, Math.ceil((state.phaseEndsAt - nowMs) / 1000));
  }

  // Continuous work hours used to calculate weight.
  // workStreakStartedAt resets only when a break is actually completed.
  function continuousWorkHours(workStreakStartedAt, nowMs) {
    if (workStreakStartedAt === null || workStreakStartedAt === undefined) return 0;
    return Math.max(0, (nowMs - workStreakStartedAt) / (1000 * 60 * 60));
  }

  // Determine the next state when the current phase elapses.
  function advancePhase(state, settings, nowMs) {
    const workMs = clampWorkMinutes(settings.workMinutes) * 60 * 1000;
    const breakMs = BREAK_MINUTES * 60 * 1000;
    if (state.phase === "work") {
      const streak =
        state.workStreakStartedAt === null || state.workStreakStartedAt === undefined
          ? nowMs
          : state.workStreakStartedAt;
      return {
        phase: "break",
        phaseEndsAt: nowMs + breakMs,
        workStreakStartedAt: streak,
        breakStartedAt: nowMs,
      };
    }
    if (state.phase === "break") {
      // Break completed -> reset streak, start a fresh work cycle.
      return {
        phase: "work",
        phaseEndsAt: nowMs + workMs,
        workStreakStartedAt: nowMs,
        breakStartedAt: null,
      };
    }
    // idle -> work
    return {
      phase: "work",
      phaseEndsAt: nowMs + workMs,
      workStreakStartedAt: nowMs,
      breakStartedAt: null,
    };
  }

  const api = {
    DEFAULT_WORK_MINUTES,
    BREAK_MINUTES,
    MIN_WORK_MINUTES,
    MAX_WORK_MINUTES,
    weightStageForHours,
    stretchFactor,
    clampWorkMinutes,
    formatMMSS,
    remainingSeconds,
    continuousWorkHours,
    advancePhase,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CatTimer = api;
  }
})(typeof self !== "undefined" ? self : this);
