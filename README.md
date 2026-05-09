# Fat Orange Cat

A pomodoro tool that enforces 5-minute breaks via an annoyed, entitled,
unbothered orange cat that sits on your screen and refuses to leave. Skip your
breaks and he gets fatter.

The repo houses two independent products that share the same logic, the same
cat, and the same personality:

| Project | Status | Where |
| --- | --- | --- |
| Chrome MV3 extension | shipped — covers every browser tab on every browser window | [chrome-extension/](chrome-extension/) |
| Android app | in progress — covers every app on the device via a system overlay | [android-app/](android-app/) |

Each subdirectory is a complete project with its own README, build scripts,
and tests. Pick one:

- [chrome-extension/README.md](chrome-extension/README.md) — install, configure,
  and release the Chrome extension. Tested with `node tests/run-tests.js` from
  inside `chrome-extension/`.
- [android-app/README.md](android-app/README.md) — build the Android app, run
  unit tests, and (eventually) ship to the Play Store. Tested with
  `./gradlew test` from inside `android-app/`.

## Why two projects, not one

A Chrome extension cannot draw on top of other applications or the OS desktop —
it can only inject into pages it has permission for. The Android app picks up
that gap: with the user's "Display over other apps" permission, the cat covers
**every app on the phone** during a break, not just a browser tab.

## Shared design

Both projects implement the same spec:

- 25-minute work blocks (configurable 1–120) followed by a fixed 5-minute break.
- The cat cannot be dismissed during a break. Period.
- Continuous-work hours determine weight: smug → chunky → rotund → obscene
  (~half the screen) → eclipse (~85% of the screen) at 5 hours.
- The streak only resets when a break **completes**, not when the user gives up.
- 30-second pre-break warning that does not block input.

The pure timer logic lives in two places that mirror each other line-for-line:

- [chrome-extension/lib/timer-logic.js](chrome-extension/lib/timer-logic.js) — JS
- [android-app/app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](android-app/app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt) — Kotlin

If you change the spec, change both, and update the unit tests in both
projects in the same change.

## Personality

Phrases live in
[chrome-extension/cat.js](chrome-extension/cat.js) and
[android-app/app/src/main/kotlin/com/fatorangecat/core/CatArt.kt](android-app/app/src/main/kotlin/com/fatorangecat/core/CatArt.kt).
Tests in both projects reject "sorry" and "please". Keep him on-brand: dry,
short, unbothered.

## License

[MIT](LICENSE).
