# Fat Orange Cat — Android

A pomodoro app that draws a fat orange cat over **every app** during a break.
Same spec, same cat, same personality as the Chrome extension — but with
real OS-level coverage instead of just browser tabs.

> **Status: PR #2 of 3 landed.** The app is now feature-complete for the
> first end-to-end run: settings UI, foreground timer service, exact-alarm
> phase boundaries, system-overlay during breaks, the byte-identical SVG
> cat. PR #3 lands Play Store assets, signing config, and listing copy.

## Layout

```
android-app/
├── settings.gradle.kts
├── build.gradle.kts            # root build script
├── gradle.properties
├── gradle/wrapper/             # wrapper config (jar regenerated on first sync)
└── app/
    ├── build.gradle.kts        # app module — Compose + DataStore + Lifecycle
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── kotlin/com/fatorangecat/
        │   │   ├── CatApplication.kt          # notification channels, DI container
        │   │   ├── MainActivity.kt            # Compose entry point
        │   │   ├── core/                      # pure logic (PR #1)
        │   │   │   ├── TimerLogic.kt
        │   │   │   └── CatArt.kt
        │   │   ├── data/                      # DataStore-backed repositories
        │   │   │   ├── SettingsRepository.kt
        │   │   │   ├── StateRepository.kt
        │   │   │   └── AppContainer.kt
        │   │   ├── service/
        │   │   │   ├── TimerService.kt        # foreground service, owns alarms
        │   │   │   ├── PhaseAlarmReceiver.kt  # AlarmManager → service
        │   │   │   ├── BootReceiver.kt        # rearm on reboot
        │   │   │   └── CatOverlayService.kt   # SYSTEM_ALERT_WINDOW + WebView
        │   │   └── ui/
        │   │       ├── SettingsScreen.kt
        │   │       └── theme/Theme.kt
        │   └── res/
        │       ├── drawable/                  # adaptive launcher icon
        │       ├── mipmap-anydpi-v26/         # ic_launcher / ic_launcher_round
        │       └── values/                    # strings.xml, colors.xml, themes.xml
        └── test/
            └── kotlin/com/fatorangecat/core/
                ├── TimerLogicTest.kt          # 26 tests (one-for-one with JS)
                └── CatArtTest.kt              # 4 tests
```

## Setup

You need **JDK 17+** and **Android Studio** (Hedgehog or later) — the IDE
bundles the Android SDK, Gradle, and the Kotlin plugin. CLI-only setup also
works if you have a JDK and the Android command-line tools.

### First-time

```bash
# from inside android-app/
gradle wrapper           # generates gradle/wrapper/gradle-wrapper.jar + gradlew
./gradlew test           # runs the JUnit suite
./gradlew assembleDebug  # builds an installable APK
```

If you don't have a system Gradle, open `android-app/` in Android Studio
once — it will sync, generate the wrapper, and download dependencies. Then
`./gradlew` works from the CLI.

### Run on a device

```bash
./gradlew installDebug
adb shell am start -n com.fatorangecat/.MainActivity
```

### Run unit tests

```bash
./gradlew test
```

Expect 30 tests passing — same scenario count as
`chrome-extension/tests/run-tests.js`. If the count drops, something
diverged from the spec; fix it before merging.

## How the Android version differs from the extension

| Concern | Chrome extension | Android app |
| --- | --- | --- |
| Coverage during break | every browser tab on every window | **every app on the device** |
| Trigger | `chrome.alarms` in service worker | `AlarmManager.setExactAndAllowWhileIdle` + foreground service |
| Overlay | `<div>` injected into each tab | `WindowManager` overlay via `SYSTEM_ALERT_WINDOW` |
| Cat rendering | inline SVG in the DOM | inline SVG inside a `WebView` (byte-identical) |
| Settings UI | extension popup | Compose screen |
| Persistence | `chrome.storage.local` | `DataStore<Preferences>` |
| Tests | `node tests/run-tests.js` | `./gradlew test` |
| Reboot recovery | not applicable | `BootReceiver` re-arms |

The pure spec — phase machine, weight stages, stretch curve, warning window,
clamping, MM:SS formatting, force-break semantics — is identical and ported
line-for-line. See
[app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt).

## Permissions, in plain language

When you launch the app for the first time, you'll be prompted for:

- **Display over other apps** (`SYSTEM_ALERT_WINDOW`) — required. This is
  what lets the cat draw over other apps. Without it, the cat only shows
  while Fat Orange Cat itself is foregrounded, which defeats the point.
  Toggle in *Settings → Apps → Special access → Display over other apps*.
- **Exact alarms** (`SCHEDULE_EXACT_ALARM`) — required. Phase boundaries
  must fire on time, not when Android decides it's convenient. The app
  falls back to inexact alarms if denied, but you'll see breaks land
  minutes late.
- **Notifications** (`POST_NOTIFICATIONS`, Android 13+) — recommended.
  Used for the ongoing service notification and the 30-second pre-break
  warning. The app works without it, but you lose the heads-up.

The app's permission cards link straight to the right system settings page
for each.

## Lockdown — what survives, what doesn't

The cat is owned by the OS window manager, not by an Activity. So:

- **Pressing Home** sends you to the launcher — but the cat stays on top.
- **Recents / app switcher** doesn't dismiss it for the same reason.
- **Back button** is intercepted and consumed.
- **Tapping the screen** doesn't reach the app behind the overlay.
- **Swiping down notifications** still works — and you can technically tap
  through to *Settings → Display over other apps* and revoke the permission.
  The spec says he refuses to leave, not that he prevents you from yanking
  the OS-level switch. Don't yank it.

## Roadmap

- **PR #1**: repo split + Kotlin port of pure logic + JUnit tests. ✅
- **PR #2** (this one): `MainActivity` (Compose settings UI), `TimerService`
  (foreground), `CatOverlayService` (`SYSTEM_ALERT_WINDOW`), `DataStore`
  persistence, alarm + boot receivers, adaptive launcher icon. ✅
- **PR #3**: Play-Store-ready icons (foreground / monochrome / round
  refinement), signing config, Play Console listing draft, screenshots,
  privacy policy, store-ready release build script.

## Files to read first

When working in this directory, read these in order:

1. [CLAUDE.md](CLAUDE.md) — Android-specific guidance for Claude Code.
2. [app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt) — the spec, in code.
3. [app/src/main/kotlin/com/fatorangecat/service/TimerService.kt](app/src/main/kotlin/com/fatorangecat/service/TimerService.kt) — the timer's heartbeat.
4. [app/src/main/kotlin/com/fatorangecat/service/CatOverlayService.kt](app/src/main/kotlin/com/fatorangecat/service/CatOverlayService.kt) — the cat itself.
5. [app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt](app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt) — the contract.
