# CLAUDE.md — android-app

Guidance for Claude Code working inside `android-app/`. Read the **root**
[../CLAUDE.md](../CLAUDE.md) first — it covers spec invariants that apply to
both projects.

## What this project is

The Android counterpart to the Chrome extension. Same spec, same cat, same
personality — but with `SYSTEM_ALERT_WINDOW` so the cat draws over **every
app on the device**, not just browser tabs.

**This PR (PR #1) only contains the scaffold + pure logic.** UI, services,
persistence, and the actual overlay land in PR #2. Don't add Android-specific
code to this PR unless it's strictly needed by the unit tests.

## Architecture (current)

- [app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt) —
  **pure** Kotlin port of `chrome-extension/lib/timer-logic.js`. No Android
  imports. Runnable on plain JVM JUnit. Mirrors the JS API line-for-line:
  `weightStageForHours`, `stretchFactor`, `clampWorkMinutes`, `formatMMSS`,
  `remainingSeconds`, `shouldWarn`, `continuousWorkHours`, `advancePhase`.
- [app/src/main/kotlin/com/fatorangecat/core/CatArt.kt](app/src/main/kotlin/com/fatorangecat/core/CatArt.kt) —
  pure Kotlin port of `chrome-extension/cat.js`. `PHRASES` and `svgMarkup()`
  are byte-for-byte identical to the JS originals.
- [app/src/test/kotlin/com/fatorangecat/core/](app/src/test/kotlin/com/fatorangecat/core/) —
  JUnit 4 tests. One Kotlin test per JS test, mirrored.
- [app/src/main/AndroidManifest.xml](app/src/main/AndroidManifest.xml) —
  declares the permissions PR #2 will use; no `<activity>` yet.
- [app/build.gradle.kts](app/build.gradle.kts) — minimum viable Android
  application module. Only dependency is JUnit, intentionally.

## Architecture (planned for PR #2)

Don't implement these yet, but know they're coming:

- `MainActivity` (Compose) — the settings screen. Talks to `TimerService`
  via bound-service or `LocalBroadcastManager`. Mirrors the extension popup.
- `TimerService` (foreground) — owns phase state, schedules `AlarmManager`
  for `cat-phase-end`, broadcasts state changes. Analogue of the SW.
- `CatOverlayService` — adds a `WindowManager` overlay with `TYPE_APPLICATION_OVERLAY`
  when phase = BREAK. Renders the cat via Compose Canvas; intercepts touches.
- `BootReceiver` — re-arms `TimerService` after device reboot.
- `data/SettingsRepository` — `DataStore<Preferences>` wrapper for
  `workMinutes` + `enabled`. Analogue of `chrome.storage.local`.
- `ui/theme/` — Compose theme matching the popup: black background, orange
  cat, system font, no decoration.

## Conventions

- **Pure logic in `core/`, side effects elsewhere.** If you catch yourself
  reaching for `android.*` inside `core/TimerLogic.kt`, stop — `TimerLogic`
  must remain JVM-testable with no Robolectric, no instrumented tests.
- **No Compose / no Hilt / no Coroutines in `core/`.** It's plain Kotlin
  stdlib only. PR #2 adds those for the UI layer.
- **No build-step magic.** Stick to `kotlin-android` and `com.android.application`.
  Don't pull in KSP, Detekt, etc., without explicit user request.
- **No emojis in code or UI.** Same as the extension.
- **Comments only when WHY is non-obvious.** Identifiers do the explaining.
- **Tests are JUnit 4, no mocks.** Pure logic doesn't need Mockito. If a
  future test needs `Context`, add Robolectric to `testImplementation` —
  but ask first.

## Spec invariants you must not break

The same invariants from the root [../CLAUDE.md](../CLAUDE.md):

1. `workStreakStartedAt` resets only when a break completes. The regression
   test is `scenario_breakCompletionIsTheOnlyPathToResetWeight` in
   [TimerLogicTest.kt](app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt).
2. `BREAK_MINUTES = 5`, fixed. If you make this configurable, do it on
   *both* sides (JS and Kotlin) in the same change.
3. Weight: hour 3 → stage 3 with `sizeFactor ≥ 0.5`; hour 5 → stage 4 with
   `sizeFactor ≥ 0.8`. Both pinned in `weightStages_matchTheSpec`.
4. `WARNING_SECONDS = 30`, exposed as `TimerLogic.WARNING_SECONDS`.

## Running tests

From inside `android-app/`:

```bash
./gradlew test
```

Expect 28 tests passing — same count as the extension's `tests/run-tests.js`.
If a Kotlin test fails but its JS counterpart passes, the port diverged from
the spec; fix the Kotlin side. If the JS test passes but no Kotlin
counterpart exists, add one — the suites must stay in lockstep.

## Common tasks

- **Add a phase / weight test**: append a `@Test` to
  [TimerLogicTest.kt](app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt).
  Add the JS counterpart in `chrome-extension/tests/timer-logic.test.js` in
  the same change.
- **Tweak personality**: edit `PHRASES` in
  [CatArt.kt](app/src/main/kotlin/com/fatorangecat/core/CatArt.kt) and the JS
  twin in `chrome-extension/cat.js`. The "no apologies / no please" rule is
  enforced on both sides.
- **Wire a new pure function**: add it to `TimerLogic.kt`, then mirror in
  `lib/timer-logic.js`. Test on both sides in the same PR.

## What not to do

- Don't add Android dependencies to `core/`. The whole point of `core/` is
  that it runs on plain JVM JUnit with no emulator.
- Don't drift from the JS implementation. The two are a contract; if you
  need to change behavior, change both.
- Don't introduce Coroutines, Flow, RxJava, etc., into `core/`. Pure
  functions only — async lives in the service layer (PR #2).
- Don't commit `gradle-wrapper.jar`, `local.properties`, or `*.keystore`.
  The `.gitignore` covers them; double-check before you commit.
- Don't bypass the unit-test contract. PR #2 will add overlay tests with
  Robolectric; PR #1's JVM tests stay green forever.
