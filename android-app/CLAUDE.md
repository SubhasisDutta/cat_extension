# CLAUDE.md — android-app

Guidance for Claude Code working inside `android-app/`. Read the **root**
[../CLAUDE.md](../CLAUDE.md) first — it covers spec invariants that apply to
both projects.

## What this project is

The Android counterpart to the Chrome extension. Same spec, same cat, same
personality — but with `SYSTEM_ALERT_WINDOW` so the cat draws over **every
app on the device**, not just browser tabs.

## Architecture (one-liner per file)

### Pure logic (no Android deps)

- [app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt) —
  Kotlin port of `chrome-extension/lib/timer-logic.js`. `weightStageForHours`,
  `stretchFactor`, `clampWorkMinutes`, `formatMMSS`, `remainingSeconds`,
  `shouldWarn`, `continuousWorkHours`, `advancePhase`. JVM-testable.
- [app/src/main/kotlin/com/fatorangecat/core/CatArt.kt](app/src/main/kotlin/com/fatorangecat/core/CatArt.kt) —
  port of `chrome-extension/cat.js`. `PHRASES` and `svgMarkup()` are
  byte-identical to the JS originals.

### State + persistence

- [data/SettingsRepository.kt](app/src/main/kotlin/com/fatorangecat/data/SettingsRepository.kt) —
  `DataStore<Preferences>` wrapper for `workMinutes` + `enabled`. Analogue of
  `chrome.storage.local["settings"]`. Always clamps `workMinutes` via
  `TimerLogic.clampWorkMinutes` on read AND on write — same defense-in-depth
  as the extension popup.
- [data/StateRepository.kt](app/src/main/kotlin/com/fatorangecat/data/StateRepository.kt) —
  separate `DataStore` for the `TimerState`. Sole writer is `TimerService`;
  observers (Activity, overlay) read the `Flow`. Persistence here is what
  lets the timer survive process death and reboot.
- [data/AppContainer.kt](app/src/main/kotlin/com/fatorangecat/data/AppContainer.kt) —
  manual DI. Held by `CatApplication`. Don't add Hilt for one app.

### Service layer (the equivalents of `background.js`)

- [CatApplication.kt](app/src/main/kotlin/com/fatorangecat/CatApplication.kt) —
  registers two notification channels (`timer` low-priority for the ongoing
  service notification, `warning` high-priority for the 30-second pre-break
  heads-up).
- [service/TimerService.kt](app/src/main/kotlin/com/fatorangecat/service/TimerService.kt) —
  foreground service (type=`specialUse`). Sole owner of phase transitions.
  Schedules `AlarmManager.setExactAndAllowWhileIdle` for `cat-phase-end`,
  receives the alarm via `PhaseAlarmReceiver`, advances phase, persists state.
  Also starts/stops `CatOverlayService` based on phase. Maintains a
  countdown notification that ticks every second while non-IDLE.
  Exposes static helpers `start`, `stop`, `forceBreak`, `notifySettingsChanged`
  for the Activity to talk to it via intents.
- [service/PhaseAlarmReceiver.kt](app/src/main/kotlin/com/fatorangecat/service/PhaseAlarmReceiver.kt) —
  thin trampoline from `AlarmManager` → `TimerService.ACTION_PHASE_END`.
  No state mutation here; the service does it all.
- [service/BootReceiver.kt](app/src/main/kotlin/com/fatorangecat/service/BootReceiver.kt) —
  on `BOOT_COMPLETED` / `LOCKED_BOOT_COMPLETED`, re-arms the timer if the
  user had it enabled. The cat's promise survives reboots.
- [service/CatOverlayService.kt](app/src/main/kotlin/com/fatorangecat/service/CatOverlayService.kt) —
  the Android equivalent of `content.js`. Adds a `TYPE_APPLICATION_OVERLAY`
  window via `WindowManager`, full-screen, `FLAG_LAYOUT_NO_LIMITS`. Hosts a
  `WebView` that loads `CatArt.svgMarkup()` so the cat is byte-identical to
  the extension. Reads phase / weight / stretch from the state Flow and
  re-renders every second. Consumes touches via `setOnTouchListener` and
  swallows `KEYCODE_BACK` / `KEYCODE_APP_SWITCH` / `KEYCODE_MENU` via
  `setOnKeyListener`. Home cannot be intercepted by an app — but the
  overlay is owned by `WindowManager`, so pressing Home does NOT dismiss it.

### UI layer (Compose, only used by the activity)

- [MainActivity.kt](app/src/main/kotlin/com/fatorangecat/MainActivity.kt) —
  `ComponentActivity` (no AppCompat). Hosts `SettingsScreen` via
  `setContent`. Collects settings + state Flows with
  `collectAsStateWithLifecycle`. Drives a 1-Hz `nowMs` ticker so the
  countdown updates while the screen is visible. Also handles permission
  requests: overlay (`ACTION_MANAGE_OVERLAY_PERMISSION`),
  exact-alarm (`ACTION_REQUEST_SCHEDULE_EXACT_ALARM`),
  notifications (`POST_NOTIFICATIONS`).
- [ui/SettingsScreen.kt](app/src/main/kotlin/com/fatorangecat/ui/SettingsScreen.kt) —
  the Compose analogue of `popup.html`. Status card (phase, time remaining,
  weight, streak), settings card (work minutes input, enabled switch),
  summon-now card, plus permission-request cards rendered conditionally.
- [ui/theme/Theme.kt](app/src/main/kotlin/com/fatorangecat/ui/theme/Theme.kt) —
  Material 3 light color scheme using the same orange palette as
  `colors.xml` and the SVG.

## State model

Two DataStores, mirroring the Chrome extension's two storage keys:

- `settings.preferences_pb` — `workMinutes` (Int), `enabled` (Bool).
- `timer_state.preferences_pb` — `phase` (String), `phaseEndsAt` (Long),
  `workStreakStartedAt` (Long, 0 = null), `breakStartedAt` (Long, 0 = null).

Critical invariant (copied from the extension):
**`workStreakStartedAt` only resets when a break completes**. The regression
test is
[`scenario_breakCompletionIsTheOnlyPathToResetWeight`](app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt).

The phase machine is `IDLE → WORK → BREAK → WORK → BREAK → …`. Implemented
in `TimerLogic.advancePhase` — same code path as the extension, same tests.

## Lockdown during break

The overlay is owned by `WindowManager`, not by an Activity. That alone is
most of the lockdown:

- Pressing **Home** sends the user to the launcher, but our window stays on
  top because `TYPE_APPLICATION_OVERLAY` outranks normal windows.
- Switching apps via **Recents** does the same — overlay survives.
- The **Back** button is intercepted by `setOnKeyListener` and consumed.
- All **touches** inside the overlay are consumed by `setOnTouchListener`,
  so taps don't reach the underlying app.
- The user *can* swipe down notifications and tap settings to revoke our
  overlay permission. This is unavoidable; the spec says he refuses to
  leave, not that he prevents you from removing the OS-level switch.

If you add interactive elements during a break, they must live inside the
overlay's `FrameLayout` so the touch listener can detect taps inside our
view tree (analogous to how the extension's overlay subtree is excluded
from the block handler).

## Permissions you must keep granted

- **`SYSTEM_ALERT_WINDOW`** ("Display over other apps") — **required**.
  Without it, `CatOverlayService.onCreate` self-stops. The activity shows
  a permission card if it's missing.
- **`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`** — **required** for phase
  boundaries to fire on time. We fall back to `setAndAllowWhileIdle` if
  denied, but Android may delay it by minutes — broken UX.
- **`POST_NOTIFICATIONS`** (Android 13+) — recommended. Used for the
  ongoing service notification and the 30-second pre-break warning.
- **`FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE`** — required
  for `TimerService` to run; declared in the manifest with the
  `pomodoro_break_overlay_timer` subtype property.
- **`RECEIVE_BOOT_COMPLETED`** — required so `BootReceiver` re-arms the
  timer after reboot.

## Conventions

- **Pure logic in `core/`, side effects elsewhere.** If you catch yourself
  reaching for `android.*` inside `core/TimerLogic.kt`, stop.
- **No Compose / no Coroutines in `core/`.** Plain Kotlin stdlib only.
- **Single source of truth = DataStore.** `TimerService` is the only
  writer for state. Activity / overlay only read.
- **No mocks in tests.** `TimerLogic` and `CatArt` are pure functions; they
  don't need them. Service / Activity tests would need Robolectric, which
  we haven't pulled in yet — manual device testing covers them for now.
- **No emojis in code or UI.** Same as the extension.
- **Comments only when WHY is non-obvious.** The codebase is small.

## Spec invariants you must not break

Same set as `chrome-extension/CLAUDE.md`:

1. `workStreakStartedAt` resets only when a break completes.
2. `BREAK_MINUTES = 5`, fixed.
3. Weight at hour 3 has `sizeFactor >= 0.5`; at hour 5 `>= 0.8`.
4. `WARNING_SECONDS = 30`.
5. Force-break (`Summon him now`) does NOT reset the streak. The pure
   regression test is `scenario_forceBreakStartsBreakAndPreservesStreak`.

## Running tests

From inside `android-app/`:

```bash
./gradlew test
```

Expect 30 tests passing — same count as `chrome-extension/tests/run-tests.js`.
If a Kotlin test fails but its JS counterpart passes, the port diverged
from the spec; fix the Kotlin side. If the JS test passes but no Kotlin
counterpart exists, add one — the suites must stay in lockstep.

## Manual smoke test

The unit tests cover pure logic only. For service / overlay / UI behavior
you need a device or emulator:

1. Open in Android Studio, sync, run on an Android 12+ device or emulator.
2. On first launch, grant **Display over other apps** when prompted.
3. On Android 12+, grant **Exact alarms** in app info → permissions.
4. On Android 13+, grant **Notifications**.
5. Hit **Summon him now**. The cat overlay should fill the screen
   immediately, even if you press Home / open another app afterwards.
6. Confirm:
   - Touches do not reach the app behind the overlay.
   - Back press is swallowed.
   - The cat stretches over the first ~13 seconds, then settles.
   - Phrases rotate every second.
   - Timer counts 5:00 → 0:00, then the overlay disappears.
   - The notification updates in lockstep.
7. Toggle **Cat is on duty** off and on; confirm the timer stops/starts.
8. Reboot the device with the cat enabled; confirm the timer resumes.

Notes go in the PR description.

## Common tasks

- **Add a phase / weight test**: append a `@Test` to
  [TimerLogicTest.kt](app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt).
  Add the JS counterpart in `chrome-extension/tests/timer-logic.test.js` in
  the same change.
- **Tweak personality**: edit `PHRASES` in
  [CatArt.kt](app/src/main/kotlin/com/fatorangecat/core/CatArt.kt) and the JS
  twin in `chrome-extension/cat.js`. The "no apologies / no please" rule is
  enforced on both sides.
- **Change the foreground notification text**: edit `buildNotification` in
  `TimerService.kt` and the strings in `res/values/strings.xml`.
- **Tune the cat overlay layout**: edit `buildRootView` /
  `buildCatWebView` in `CatOverlayService.kt`. The cat itself is rendered
  by a WebView loading `CatArt.svgMarkup()` — don't redraw it natively
  unless you also update the extension to match.

## What not to do

- Don't add Android dependencies to `core/`.
- Don't drift from the JS implementation. The two are a contract.
- Don't introduce Coroutines / Flow into `core/`. Pure functions only —
  async lives in the service / repository layer.
- Don't move state mutation out of `TimerService`. Activity reads, never
  writes; overlay reads, never writes.
- Don't try to block the Home button or use Accessibility services to
  force-focus. Play Store will reject it.
- Don't commit `gradle-wrapper.jar`, `local.properties`, or `*.keystore`.
  `.gitignore` covers them.
