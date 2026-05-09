# Fat Orange Cat — Android

A pomodoro app that draws a fat orange cat over **every app** during a break.
Same spec, same cat, same personality as the Chrome extension — but with
real OS-level coverage instead of just browser tabs.

> **Status: PR #1 of 3.** This PR contains the project scaffold, the pure
> timer logic ported from JS to Kotlin, and the JUnit test suite that mirrors
> the JS tests one-for-one. The system overlay, foreground service, and
> Compose UI ship in PR #2. Play Store packaging ships in PR #3.

## Layout

```
android-app/
├── settings.gradle.kts
├── build.gradle.kts            # root build script
├── gradle.properties
├── gradle/wrapper/             # wrapper config (jar regenerated on first sync)
└── app/
    ├── build.gradle.kts        # app module — only depends on JUnit for now
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml         # permissions: SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE, etc.
        │   ├── kotlin/com/fatorangecat/core/
        │   │   ├── TimerLogic.kt           # pure logic; mirrors lib/timer-logic.js
        │   │   └── CatArt.kt               # SVG + phrases; mirrors cat.js
        │   └── res/values/strings.xml
        └── test/
            └── kotlin/com/fatorangecat/core/
                ├── TimerLogicTest.kt       # 24 tests; one-for-one with timer-logic.test.js
                └── CatArtTest.kt           # 4 tests; one-for-one with cat-art.test.js
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
```

If you don't have a system Gradle, open `android-app/` in Android Studio
once — it will sync, generate the wrapper, and download dependencies. Then
`./gradlew test` works from the CLI.

### Run unit tests

```bash
./gradlew test
```

Expect 28 tests passing — same scenario count as the JS suite. If the count
drops, something diverged from the spec; fix it before merging.

### Run a debug build (PR #2 onwards)

```bash
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

The debug APK installs but currently has no UI — the activity lands in PR #2.

## How the Android version differs from the extension

| Concern | Chrome extension | Android app |
| --- | --- | --- |
| Coverage during break | every browser tab on every window | **every app on the device** |
| Trigger | `chrome.alarms` in service worker | `AlarmManager` + foreground service (PR #2) |
| Overlay | `<div>` injected into each tab | `WindowManager` overlay via `SYSTEM_ALERT_WINDOW` (PR #2) |
| Settings UI | extension popup | Compose screen (PR #2) |
| Persistence | `chrome.storage.local` | `DataStore` (PR #2) |
| Tests | `node tests/run-tests.js` | `./gradlew test` |

The pure spec — phase machine, weight stages, stretch curve, warning window,
clamping, MM:SS formatting — is identical and ported line-for-line. See
[app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt).

## Permissions explained

When the app launches in PR #2, the user will be prompted for:

- **Display over other apps** (`SYSTEM_ALERT_WINDOW`) — required. This is
  what lets the cat draw over other apps. Without it, the cat only shows
  while the app itself is in the foreground, which defeats the point.
- **Foreground service** — required. Keeps the timer alive while the screen
  is off or the app is backgrounded.
- **Notifications** (Android 13+) — optional. Used for the 30-second
  pre-break warning when the app is backgrounded.
- **Exact alarms** — required. Phase boundaries (work → break, break → work)
  must fire on time, not when Android decides it's convenient.

## Roadmap

- **PR #1** (this one): repo split + Kotlin port of pure logic + JUnit tests.
- **PR #2**: `MainActivity` (Compose settings UI), `TimerService` (foreground),
  `CatOverlayService` (`SYSTEM_ALERT_WINDOW`), `DataStore` persistence,
  Compose Canvas rendering of the cat SVG, lockdown of touch events on the
  overlay, boot-completed receiver.
- **PR #3**: Play-Store-ready icons (foreground / monochrome / round),
  signing config, Play Console listing draft, screenshots, privacy policy.

## Files to read first

When working in this directory, read these in order:

1. [CLAUDE.md](CLAUDE.md) — Android-specific guidance for Claude Code.
2. [app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt) — the spec, in code.
3. [app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt](app/src/test/kotlin/com/fatorangecat/core/TimerLogicTest.kt) — the contract.
