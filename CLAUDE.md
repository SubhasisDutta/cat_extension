# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

A Chrome MV3 extension that enforces pomodoro breaks via a fat orange cat
overlay. The cat appears for 5 minutes after every work block (default 25 min,
configurable 1–120) and cannot be dismissed by users. The longer the user goes
without completing a break, the fatter the cat gets on screen.

The personality is intentional: annoyed, entitled, unbothered. Phrases live in
[cat.js](cat.js) — keep them on-brand. Tests in
[tests/cat-art.test.js](tests/cat-art.test.js) enforce no apologies / no
"please".

## Architecture (one-liner per file)

- [manifest.json](manifest.json) — MV3, `<all_urls>`, content script + service worker.
- [lib/timer-logic.js](lib/timer-logic.js) — **pure** functions (no chrome.\*
  APIs). UMD-style export so it loads in service worker, content script, popup,
  and node tests. Anything that can be a pure function belongs here.
- [background.js](background.js) — service worker. Sole owner of phase state in
  `chrome.storage.local`. Schedules `chrome.alarms` (`cat-phase-end`,
  `cat-tick`). Handles messages: `GET_STATE`, `SET_WORK_MINUTES`,
  `SET_ENABLED`, `FORCE_BREAK`. Broadcasts `CAT_STATE` to every tab + popup.
  When a break begins (or the worker wakes mid-break), calls
  `injectIntoAllTabs()` — runs `chrome.scripting.executeScript` against every
  tab so tabs that were open *before* install / reload still get the overlay.
  `canInject(url)` filters out chrome://, chrome-extension://, the Web Store,
  view-source://, etc., where Chrome refuses script injection.
- [content.js](content.js) — per-tab overlay. Three render modes:
  (1) `phase === "break"` → full overlay + scroll lock + capture-phase
  blockers for wheel/touch/contextmenu/Esc/Cmd-W;
  (2) `phase === "work"` && `T.shouldWarn(state, now)` → small bottom-right
  toast with countdown ("FAT CAT INCOMING 0:30");
  (3) otherwise → silent. Defends the break overlay with `MutationObserver`
  re-attach. Idempotent via `window.__catExtensionLoaded__`.
- [cat.js](cat.js) — inline SVG + personality phrases. No DOM access here.
- [overlay.css](overlay.css) — overlay styles. ID-prefixed (`#cat-extension-overlay`)
  to avoid host-page collisions. Uses CSS vars `--cat-size` and `--cat-stretch`.
- [popup.html](popup.html) / [popup.js](popup.js) / [popup.css](popup.css) —
  settings UI. Talks to the worker only via `chrome.runtime.sendMessage`.
- [tests/run-tests.js](tests/run-tests.js) — zero-dependency runner; discovers
  `*.test.js` siblings; exposes `test`, `test.only`, `assert.{eq,approx,truthy,throws}`.
- [icons/logo.svg](icons/logo.svg) — source-of-truth logo. PNG variants at
  16/32/48/128 sit alongside it and are referenced from
  [manifest.json](manifest.json) (`icons` + `action.default_icon`) and the popup.
- [scripts/build-icons.js](scripts/build-icons.js) — zero-dep PNG renderer
  (uses only `fs` + `zlib`). The SVG and the script must be edited together
  if the logo changes — the script does not parse the SVG.

## State model

Single source of truth lives in `chrome.storage.local` under two keys:

- `settings`: `{ workMinutes: number, enabled: boolean }`
- `state`: `{ phase: "idle"|"work"|"break", phaseEndsAt: epochMs, workStreakStartedAt: epochMs|null, breakStartedAt: epochMs|null }`

Critical invariant: **`workStreakStartedAt` only resets when a break completes**.
This is what the spec calls "the only way to shrink the cat is to actually take
the break." Don't break this. There is a regression test for it
([tests/timer-logic.test.js](tests/timer-logic.test.js) → "scenario: break
completion is the only path to reset weight").

The phase machine is `idle → work → break → work → break → …`. Implemented in
`advancePhase()` in [lib/timer-logic.js](lib/timer-logic.js).

## Weight system

`weightStageForHours(hours)` in [lib/timer-logic.js](lib/timer-logic.js)
maps continuous-work hours to a stage 0–4 with a viewport-relative `sizeFactor`.
The spec is load-bearing here:

- hour 3 → stage 3, sizeFactor ≥ 0.5 (half the screen)
- hour 5 → stage 4, sizeFactor ≥ 0.8 (can barely see the code)

Tests in [tests/timer-logic.test.js](tests/timer-logic.test.js) pin both. If
you tune the curve, update the tests in the same change.

## Stretch animation

`stretchFactor(secondsRemaining, breakSeconds)` opens from 1.0 at 5:00 to 1.6
by 4:47 (a 13-second window), then stays at 1.6. After 4:47 the overlay adds
class `cat-comfortable` which switches on a slow breathing animation.

## Conventions

- **Pure logic in `lib/`, side effects in the SW / content / popup.** If you
  catch yourself reaching for `chrome.*` inside `lib/timer-logic.js`, stop.
- **No build step.** Plain ES5-ish JS that loads as a `<script>`. Don't add
  bundlers, TypeScript, or npm dependencies without explicit user request.
- **No emojis in code or UI.** The aesthetic is dry, not cute.
- **Comments only when WHY is non-obvious.** The codebase is small; identifiers
  do the explaining.
- **Tests are no-deps node.** `node tests/run-tests.js`. Don't introduce Jest /
  Vitest / etc.

## Common tasks

- **Run tests**: `node tests/run-tests.js` from repo root. All 25 must pass.
- **Add a phase / weight test**: append to
  [tests/timer-logic.test.js](tests/timer-logic.test.js). Use
  `assert.eq` / `assert.approx`. No describe / it blocks — just `test(name, fn)`.
- **Tweak personality**: edit `PHRASES` in [cat.js](cat.js). Keep them dry,
  short, and unbothered. Tests in
  [tests/cat-art.test.js](tests/cat-art.test.js) reject "sorry" / "please".
- **Change the break length**: it's intentionally fixed at 5 min in
  `BREAK_MINUTES` ([lib/timer-logic.js](lib/timer-logic.js)). If a future
  request actually wants this configurable, plumb it through `settings` and
  add a popup input + clamp + tests.

## Limitation to remember

A Chrome extension can only inject into pages it has host permission for. It
**cannot** cover the OS desktop or other applications. "Every screen, every
window" in the spec is implemented as "every browser tab on every browser
window." If a future request wants true OS-level coverage, that's a native
app, not this extension. Be upfront about this rather than faking it.

## What not to do

- Don't store derived state. Recompute weight / stretch / remaining from the
  three fields in `state` plus `Date.now()`.
- Don't tear down the service worker's alarms casually — `cat-phase-end` is
  what advances the state machine. If you change scheduling, also change the
  alarm names + handlers consistently.
- Don't trust input from the popup. `clampWorkMinutes` exists for this reason
  and is called both in the popup write path and in `advancePhase`.
- Don't bypass the `MutationObserver` re-attach in [content.js](content.js).
  Aggressive sites otherwise rip the overlay out.
