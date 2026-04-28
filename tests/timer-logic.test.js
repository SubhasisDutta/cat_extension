const T = require("../lib/timer-logic.js");

// ---- formatMMSS ----
test("formatMMSS pads seconds", () => {
  assert.eq(T.formatMMSS(0), "0:00");
  assert.eq(T.formatMMSS(5), "0:05");
  assert.eq(T.formatMMSS(65), "1:05");
  assert.eq(T.formatMMSS(300), "5:00");
});

test("formatMMSS clamps negatives to zero", () => {
  assert.eq(T.formatMMSS(-10), "0:00");
});

// ---- clampWorkMinutes ----
test("clampWorkMinutes enforces bounds", () => {
  assert.eq(T.clampWorkMinutes(25), 25);
  assert.eq(T.clampWorkMinutes(0), 1);
  assert.eq(T.clampWorkMinutes(-7), 1);
  assert.eq(T.clampWorkMinutes(9999), 120);
  assert.eq(T.clampWorkMinutes("45"), 45);
});

test("clampWorkMinutes falls back on garbage", () => {
  assert.eq(T.clampWorkMinutes("nope"), T.DEFAULT_WORK_MINUTES);
  assert.eq(T.clampWorkMinutes(NaN), T.DEFAULT_WORK_MINUTES);
});

// ---- weightStageForHours ----
test("weight stages match the spec", () => {
  assert.eq(T.weightStageForHours(0).stage, 0);
  assert.eq(T.weightStageForHours(0.99).stage, 0);
  assert.eq(T.weightStageForHours(1).stage, 1);
  assert.eq(T.weightStageForHours(2).stage, 2);
  // hour 3 -> takes ~half the screen
  assert.eq(T.weightStageForHours(3).stage, 3);
  assert.truthy(T.weightStageForHours(3).sizeFactor >= 0.5);
  // hour 5 -> can barely see the code
  assert.eq(T.weightStageForHours(5).stage, 4);
  assert.truthy(T.weightStageForHours(5).sizeFactor >= 0.8);
});

test("weight is monotonically non-decreasing in hours", () => {
  let prev = 0;
  for (const h of [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8]) {
    const f = T.weightStageForHours(h).sizeFactor;
    assert.truthy(f >= prev, `regressed at h=${h}`);
    prev = f;
  }
});

// ---- stretchFactor ----
test("stretchFactor opens from 1.0 at 5:00 to 1.6 by 4:47", () => {
  const breakSec = 300;
  assert.approx(T.stretchFactor(300, breakSec), 1.0, 1e-6);
  assert.approx(T.stretchFactor(287, breakSec), 1.6, 1e-6);
  // halfway through the 13s window
  assert.approx(T.stretchFactor(294, breakSec), 1.0 + (6 / 13) * 0.6, 1e-6);
});

test("stretchFactor stays at 1.6 after 4:47 (the cat is comfortable)", () => {
  assert.approx(T.stretchFactor(200, 300), 1.6, 1e-6);
  assert.approx(T.stretchFactor(0, 300), 1.6, 1e-6);
});

// ---- remainingSeconds ----
test("remainingSeconds computes ceil of phase delta", () => {
  const now = 1_000_000;
  const state = { phase: "break", phaseEndsAt: now + 4500 };
  assert.eq(T.remainingSeconds(state, now), 5);
});

test("remainingSeconds floors at 0 once phase has elapsed", () => {
  const now = 1_000_000;
  const state = { phase: "break", phaseEndsAt: now - 1000 };
  assert.eq(T.remainingSeconds(state, now), 0);
});

test("remainingSeconds returns 0 when idle", () => {
  assert.eq(T.remainingSeconds({ phase: "idle" }, 1), 0);
});

// ---- continuousWorkHours ----
test("continuousWorkHours counts from streak start", () => {
  const start = 0;
  const oneHour = 60 * 60 * 1000;
  assert.approx(T.continuousWorkHours(start, oneHour), 1, 1e-6);
  assert.approx(T.continuousWorkHours(start, 3 * oneHour), 3, 1e-6);
});

test("continuousWorkHours is 0 when no streak is set", () => {
  assert.eq(T.continuousWorkHours(null, Date.now()), 0);
});

// ---- advancePhase: idle -> work -> break -> work ----
test("advancePhase from idle starts a work block", () => {
  const now = 1_000_000;
  const next = T.advancePhase(
    { phase: "idle", phaseEndsAt: 0, workStreakStartedAt: null },
    { workMinutes: 25 },
    now
  );
  assert.eq(next.phase, "work");
  assert.eq(next.phaseEndsAt, now + 25 * 60 * 1000);
  assert.eq(next.workStreakStartedAt, now);
});

test("advancePhase from work transitions to break and preserves streak", () => {
  const streakStart = 1_000_000;
  const now = streakStart + 25 * 60 * 1000;
  const next = T.advancePhase(
    { phase: "work", phaseEndsAt: now, workStreakStartedAt: streakStart },
    { workMinutes: 25 },
    now
  );
  assert.eq(next.phase, "break");
  assert.eq(next.phaseEndsAt, now + 5 * 60 * 1000);
  assert.eq(next.workStreakStartedAt, streakStart, "streak must persist into break");
  assert.eq(next.breakStartedAt, now);
});

test("advancePhase from break resets the streak — the only way to shrink the cat", () => {
  const streakStart = 0;
  const breakEnd = streakStart + 30 * 60 * 1000;
  const next = T.advancePhase(
    { phase: "break", phaseEndsAt: breakEnd, workStreakStartedAt: streakStart },
    { workMinutes: 25 },
    breakEnd
  );
  assert.eq(next.phase, "work");
  assert.eq(next.workStreakStartedAt, breakEnd, "streak must reset after a completed break");
});

test("advancePhase respects custom work minutes from settings", () => {
  const now = 0;
  const next = T.advancePhase({ phase: "idle" }, { workMinutes: 50 }, now);
  assert.eq(next.phaseEndsAt, 50 * 60 * 1000);
});

test("advancePhase clamps absurd workMinutes (defends against popup tampering)", () => {
  const now = 0;
  const tooBig = T.advancePhase({ phase: "idle" }, { workMinutes: 100000 }, now);
  assert.eq(tooBig.phaseEndsAt, T.MAX_WORK_MINUTES * 60 * 1000);
  const tooSmall = T.advancePhase({ phase: "idle" }, { workMinutes: 0 }, now);
  assert.eq(tooSmall.phaseEndsAt, T.MIN_WORK_MINUTES * 60 * 1000);
});

// ---- Scenario: end-to-end weight gain across a 5h streak ----
test("scenario: 5 hours of unbroken work lands in the eclipse stage", () => {
  const t0 = 0;
  let state = T.advancePhase({ phase: "idle" }, { workMinutes: 25 }, t0);
  // Pretend the user keeps cancelling breaks (well, they can't — but this
  // simulates the streak logic if the break never *completes*).
  const fiveHours = 5 * 60 * 60 * 1000;
  const hours = T.continuousWorkHours(state.workStreakStartedAt, t0 + fiveHours);
  const weight = T.weightStageForHours(hours);
  assert.eq(weight.stage, 4);
  assert.eq(weight.label, "eclipse");
});

// ---- Scenario: timer reaches 0 exactly at break end ----
test("scenario: countdown hits 0:00 exactly at phaseEndsAt", () => {
  const phaseEndsAt = 1_700_000_000_000;
  const state = { phase: "break", phaseEndsAt };
  assert.eq(T.formatMMSS(T.remainingSeconds(state, phaseEndsAt)), "0:00");
  assert.eq(T.formatMMSS(T.remainingSeconds(state, phaseEndsAt - 1000)), "0:01");
});

// ---- Scenario: the only way to shrink the cat is to take the break ----
test("scenario: break completion is the only path to reset weight", () => {
  const t0 = 0;
  // Build up a 4-hour streak.
  const streakStart = t0;
  const fourHours = 4 * 60 * 60 * 1000;
  const beforeBreak = T.weightStageForHours(
    T.continuousWorkHours(streakStart, t0 + fourHours)
  );
  assert.eq(beforeBreak.stage, 3);

  // Break completes -> streak resets -> weight returns to stage 0.
  const afterBreak = T.advancePhase(
    {
      phase: "break",
      phaseEndsAt: t0 + fourHours + 5 * 60 * 1000,
      workStreakStartedAt: streakStart,
    },
    { workMinutes: 25 },
    t0 + fourHours + 5 * 60 * 1000
  );
  const newWeight = T.weightStageForHours(
    T.continuousWorkHours(afterBreak.workStreakStartedAt, afterBreak.workStreakStartedAt)
  );
  assert.eq(newWeight.stage, 0);
});
