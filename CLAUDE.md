# CLAUDE.md

Top-level guidance. This repo contains two independent products that share a
spec but not a build:

- **[chrome-extension/](chrome-extension/)** — Chrome MV3 extension. See
  [chrome-extension/CLAUDE.md](chrome-extension/CLAUDE.md) for architecture,
  conventions, and per-file responsibilities.
- **[android-app/](android-app/)** — Android (Kotlin + Compose) app. See
  [android-app/CLAUDE.md](android-app/CLAUDE.md) for the same.

When you're working inside one of those directories, read its `CLAUDE.md`
first. Don't cross-pollinate code between them; the only thing they share is
the spec, which is mirrored as **pure logic** in both:

- [chrome-extension/lib/timer-logic.js](chrome-extension/lib/timer-logic.js)
- [android-app/app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt](android-app/app/src/main/kotlin/com/fatorangecat/core/TimerLogic.kt)

These two files implement the same functions with the same semantics — phase
machine, weight stages, stretch curve, clamping, warnings, MM:SS formatting.
If you change one, change the other in the same commit and update the unit
tests on both sides.

## Spec invariants (apply to both projects)

- `workStreakStartedAt` resets **only when a break completes**. Disabling the
  app or restarting the device does not reset weight. There are regression
  tests for this on both sides — keep them green.
- Break length is fixed at 5 minutes. If a future request actually wants this
  configurable, plumb it through *both* projects' settings + tests.
- Work minutes clamp to 1–120 in **both** the write path (popup / settings UI)
  and inside `advancePhase`. Don't trust input from UI.
- The cat is undismissable during a break. The implementation differs per
  platform but the property is non-negotiable.
- No emojis in code or UI. The aesthetic is dry, not cute.

## Working in both projects at once

- Ports must stay line-for-line equivalent. If a JS test exists, a Kotlin test
  with the same scenario must exist, and vice versa. The unit-test suites are
  the contract that proves equivalence.
- The cat's SVG markup is **identical** on both platforms — same path data,
  same colors. Don't redraw the cat per-platform.
- The PHRASES list is identical on both platforms.

## Project layout

```
.
├── chrome-extension/          # Chrome MV3 extension (shipping)
│   ├── manifest.json
│   ├── lib/timer-logic.js     # pure logic
│   ├── cat.js                 # SVG + phrases
│   ├── tests/                 # node tests; `node tests/run-tests.js`
│   └── ...
├── android-app/               # Android app (in progress)
│   ├── app/src/main/kotlin/com/fatorangecat/core/
│   │   ├── TimerLogic.kt      # pure logic, Kotlin port
│   │   └── CatArt.kt          # SVG + phrases, Kotlin port
│   ├── app/src/test/kotlin/   # JUnit; `./gradlew test`
│   └── ...
├── README.md                  # project overview
├── CLAUDE.md                  # this file
└── LICENSE
```

## Limitations (be upfront, don't fake)

- The Chrome extension cannot cover the OS desktop or other applications —
  only browser tabs. The Android app exists to fill that gap.
- The Android app cannot block other apps on iOS or desktop OSes. Don't
  promise cross-platform parity beyond what each project actually does.
