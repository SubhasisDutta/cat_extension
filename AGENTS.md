# AGENTS.md

Operating notes for autonomous coding agents working on this repo.

## Project at a glance

- **Type**: Chrome Manifest V3 extension. No build step.
- **Language**: vanilla JavaScript, no TypeScript, no bundler.
- **Dependencies**: none. Runtime is the browser; tests run on plain `node`.
- **Entry points**: [background.js](background.js) (service worker),
  [content.js](content.js) (per-tab), [popup.html](popup.html) (toolbar UI).
- **Pure logic**: [lib/timer-logic.js](lib/timer-logic.js). Tests live in
  [tests/](tests/).

Read [CLAUDE.md](CLAUDE.md) for architecture and conventions. This file is
about *how to operate* in the repo, not *what's in it*.

## Required workflow

1. **Read [CLAUDE.md](CLAUDE.md) first** if you haven't already in this session.
2. **Run the tests before and after any change**:
   ```bash
   node tests/run-tests.js
   ```
   Expect `25 passed, 0 failed` on a clean checkout. If the count drops or any
   test fails, fix it before proposing a commit.
3. **Add a test for any logic change** in [lib/timer-logic.js](lib/timer-logic.js)
   or [cat.js](cat.js). The test runner picks up any sibling `*.test.js`
   automatically.
4. **Manual smoke test** for UI changes — load unpacked at
   `chrome://extensions`, hit "Summon him now" in the popup, confirm the
   overlay appears on a normal site (e.g. example.com) and the timer counts
   down. Note results in your PR / report.

## Boundaries

- **Don't add npm dependencies, build tools, or TypeScript.** This repo is
  intentionally zero-deps. If you genuinely need one, ask first.
- **Don't break the load order**: `content_scripts.js` in
  [manifest.json](manifest.json) is `["lib/timer-logic.js", "cat.js", "content.js"]`
  in that order — `content.js` reads `window.CatTimer` and `window.CatArt`.
- **Don't put `chrome.*` calls in `lib/`.** Pure logic stays runnable in node.
- **Don't store derived state.** Recompute from
  `(state, settings, Date.now())`.
- **Don't soften the cat.** Annoyed / entitled / unbothered. No apologies, no
  "please", no emojis. Tests enforce this.
- **Don't add a way to dismiss the overlay during a break.** That's the whole
  point. The disable toggle in the popup is the supported off-switch; don't
  add a second one.
- **Don't make the 5-minute break configurable** unless the user explicitly
  asks. It's load-bearing for the product personality.

## Safe-to-do without asking

- Add tests.
- Add personality phrases to `PHRASES` in [cat.js](cat.js) (must pass the
  tone tests in [tests/cat-art.test.js](tests/cat-art.test.js)).
- Tweak overlay CSS, timer typography, popup layout.
- Refactor inside a file as long as the public shape (`window.CatTimer`,
  `window.CatArt`, message types) is preserved.
- Improve error handling around `chrome.tabs.sendMessage` failures (already
  swallowed; document if you change semantics).

## Ask before doing

- Adding any dependency, build step, or framework.
- Changing the message protocol between worker / content / popup
  (`GET_STATE`, `SET_WORK_MINUTES`, `SET_ENABLED`, `FORCE_BREAK`,
  `CAT_STATE`). Other surfaces depend on these names.
- Changing storage shape under `settings` / `state`.
- Adding new permissions to [manifest.json](manifest.json). The current set
  (`storage`, `alarms`, `tabs`, `scripting`, `<all_urls>`) is the minimum.
- Replacing the inline SVG with a binary asset (introduces a build/asset
  pipeline this repo doesn't have).
- Anything that touches the "break completion is the only weight reset"
  invariant.

## Test contract

The test runner at [tests/run-tests.js](tests/run-tests.js) is intentionally
small. The contract:

- Files matching `tests/*.test.js` are auto-loaded.
- Globals available in tests: `test(name, fn)`, `test.only(name, fn)`,
  `assert.eq`, `assert.approx`, `assert.truthy`, `assert.throws`.
- A failing test exits the process non-zero — CI / scripts can rely on this.

If you add a new module under `lib/`, add a matching `lib-name.test.js`.

## Manual test scenarios (use these for QA)

1. **Default cycle**: install unpacked, wait 25 min (or click "Summon him
   now"). Cat appears, timer starts at 5:00, cannot be Esc'd or Cmd-W'd from
   inside the page, opens on every tab in every window.
2. **Stretch animation**: at break start, cat is compact; by 4:47 it's
   stretched ~1.6× horizontally and the breathing animation kicks in.
3. **Weight gain**: in the popup, watch `streak` hours grow. After 3h the
   cat occupies ≥ 50% of `min(vw,vh)`. After 5h, ≥ 80%.
4. **Reset path**: only completing a 5-minute break resets the streak (and
   shrinks the cat). Disabling + re-enabling does not "earn" a reset for
   weight purposes — but it does end the timer, by design.
5. **Custom interval**: set work block to 1 minute in the popup, save, wait.
   Cat appears after 1 min. Set to 120, save, confirm popup shows new value.
6. **Disable**: toggle off in the popup. No cat, no timer. Toggle on. Fresh
   work block starts.
7. **Tamper resistance**: with the overlay up, run
   `document.getElementById('cat-extension-overlay').remove()` in DevTools.
   It should re-attach within a tick.

## Common pitfalls

- Treating `workStreakStartedAt === 0` as falsy. Use explicit
  `=== null || === undefined` checks. There's a fixed bug + regression test
  for this.
- Forgetting to `chrome.alarms.clear` before `create` — alarms with the same
  name get replaced anyway, but explicit clears make intent obvious.
- Not handling the "tab loaded mid-break" case. [background.js](background.js)
  pushes state on `chrome.tabs.onUpdated` (status === "complete") and
  [content.js](content.js) requests state on load. Keep both paths working.

## Reporting back

When summarizing work for the user:

- State the test count delta (e.g., "25 → 28 passing").
- Call out any change to the state shape, message protocol, or manifest
  permissions explicitly.
- If you skipped manual smoke testing because you can't load the extension,
  say so — don't claim it works.
