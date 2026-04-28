# Fat Orange Cat

A Chrome extension that enforces pomodoro breaks via an annoyed, entitled,
unbothered orange cat. Every work block (default 25 min) the cat appears for
5 minutes and refuses to leave. Skip your breaks and he gets fatter.

## What he does

- Warns you 30 seconds before he arrives (a small "FAT CAT INCOMING" toast in
  the corner — save your work).
- Appears at 5:00 on the timer, stretches out by 4:47, then sits there breathing.
- Covers every open browser tab on every window — the extension actively
  injects into already-open tabs when the break starts, not just the ones
  you load afterwards.
- Cannot be clicked through, scrolled past, dismissed via Esc, or deleted
  from the DOM (the overlay re-installs itself if a page script tries to
  remove it; scroll, wheel, touchmove, and contextmenu are all locked
  during the break).
- Gets fatter the longer you work without completing a break: smug → chunky →
  rotund → obscene (~half-screen at 3h) → eclipse (~85% of viewport at 5h).
- The only way to shrink him is to actually finish the break.

## Limitation, stated honestly

A Chrome extension cannot draw on top of other applications or the OS desktop —
it can only inject into pages it has permission for. So "every screen, every
window" is implemented as "every browser tab on every browser window." If you
alt-tab to your IDE, the cat is not there. That would require a native app, not
an extension.

## Step-by-step: how to use

### 1. Install (unpacked)

1. Clone or download this repository to a local folder.
2. Open Chrome and navigate to `chrome://extensions`.
3. In the top right, toggle **Developer mode** on.
4. Click **Load unpacked**.
5. Select the repository folder (the one that contains
   [manifest.json](manifest.json)).
6. The "Fat Orange Cat" extension appears in your list. Pin it to the toolbar
   for easy access (puzzle-piece icon → pin).

> **Updating after a code change**: changes to [background.js](background.js)
> or [manifest.json](manifest.json) require a reload — open
> `chrome://extensions` and click the circular refresh icon on the Fat
> Orange Cat card. Changes to [content.js](content.js) /
> [overlay.css](overlay.css) require a reload *and* refreshing any open
> tabs (or just letting the next break force-inject the updated script).

### 2. First-run behavior

- The extension auto-starts a 25-minute work block as soon as it's loaded.
- Nothing visible happens during work time — the cat is silent.
- After 25 minutes, the cat appears as a full-page overlay on every open tab,
  with a 5:00 countdown.

### 3. The 30-second warning

In the last 30 seconds of every work block, a small pulsing "FAT CAT INCOMING"
toast appears in the bottom-right of every tab. It does not block anything —
it's a heads-up so you can finish your sentence, save your file, or send the
message before the cat sits on you.

### 4. During a break

- The overlay covers the whole viewport on every open tab on every window.
  You cannot click through it, scroll past it, pinch-zoom past it, or close
  the tab via Esc / in-page Cmd-W (the in-page handler is blocked; OS-level
  shortcuts are still OS-level).
- The cat starts compact, stretches out over the first 13 seconds (5:00 → 4:47),
  then settles into a slow breathing animation.
- A rotating phrase appears under the timer. He is not sorry.
- When the timer hits 0:00, the overlay disappears and a fresh work block
  starts automatically.

### 5. Change the work interval

1. Click the Fat Orange Cat icon in the toolbar to open the popup.
2. Edit the **Work block (minutes)** field. Allowed range: 1–120.
3. Click **Save**.
4. The new value applies to the *next* work block. The currently-running block
   is not interrupted — finish it (or use **Summon him now**) to switch over.

### 6. Disable / re-enable

1. Open the popup.
2. Toggle **Cat is on duty** off. The timer stops immediately and any active
   overlay is removed.
3. Toggle it back on to start a fresh work cycle.

### 7. Test the cat without waiting

Click **Summon him now** in the popup. This ends the current work block
immediately and triggers a real 5-minute break overlay. Useful for demos, QA,
or when you just need a forced pause.

### 8. Watch the cat get fatter

The popup shows your current `streak` (continuous-work hours) and weight stage
(`smug`, `chunky`, `rotund`, `obscene`, `eclipse`). The streak only resets
when you complete a 5-minute break — disabling the extension does not count.

## Configuration summary

| Setting | Default | Range | Where |
| --- | --- | --- | --- |
| Work block minutes | 25 | 1–120 | popup |
| Break minutes | 5 | fixed | by design |
| Cat is on duty | on | on/off | popup |

## Tests

```bash
node tests/run-tests.js
```

Expect `28 passed, 0 failed`. Covers timer math, weight progression, the
stretch animation curve, the phase state machine (idle → work → break → work),
input clamping, the 30-second pre-break warning window, and the end-to-end
scenarios from the spec (5h streak → eclipse stage, break completion as the
only weight reset path).

## Regenerating the logo

The toolbar icon and popup logo come from [icons/](icons/). The source of
truth is [icons/logo.svg](icons/logo.svg); the PNGs at 16/32/48/128 are
rendered by a zero-dependency Node script:

```bash
node scripts/build-icons.js
```

If you change the SVG, mirror the change in [scripts/build-icons.js](scripts/build-icons.js)
and re-run — the script does not parse the SVG, it draws the same shapes
in code so we don't pull in a build pipeline.

## Files

- [manifest.json](manifest.json) — MV3 manifest
- [background.js](background.js) — service worker, alarms, state, broadcast
- [content.js](content.js) — per-tab overlay + tamper defenses
- [cat.js](cat.js) — SVG art + personality phrases
- [lib/timer-logic.js](lib/timer-logic.js) — pure logic (testable in node)
- [overlay.css](overlay.css) — overlay styles
- [popup.html](popup.html), [popup.js](popup.js), [popup.css](popup.css) — settings UI
- [tests/](tests/) — no-deps test runner
- [icons/](icons/) — toolbar / favicon assets ([logo.svg](icons/logo.svg) is the source of truth)
- [scripts/build-icons.js](scripts/build-icons.js) — regenerates the PNG icons at 16/32/48/128 from a built-in rasterizer (no deps)
- [CLAUDE.md](CLAUDE.md) — guidance for Claude Code working in this repo
- [AGENTS.md](AGENTS.md) — operating notes for autonomous coding agents

## Troubleshooting

- **Cat doesn't appear**: open the popup — is "Cat is on duty" on? Is a work
  block actively counting down? Try **Summon him now**.
- **No 30-second warning toast**: the warning only fires while a work block
  is actively counting down (not in idle, not during a break, not while
  disabled). Set the work block to 1 minute in the popup and wait — the
  toast appears at 0:30 remaining.
- **Page is still scrollable during break**: shouldn't happen — the overlay
  locks `document.documentElement.style.overflow` to `hidden`. If you see
  this, open DevTools and check whether a host-page script is overwriting
  the overflow property on a tighter timer than ours; report the URL.
- **Cat appears on most sites but not one specific site**: a few pages
  (`chrome://`, `chrome-extension://`, the Chrome Web Store, view-source,
  some PDFs) block content scripts. This is enforced by Chrome and cannot
  be overridden by extensions. Every other tab — including ones that were
  open before you installed the extension — is force-injected when a break
  starts.
- **Cat disappears mid-break**: shouldn't happen — file an issue with the URL.
  The `MutationObserver` re-attach should keep it pinned.
- **Timer drifts after laptop sleep**: the service worker may have been
  suspended. Open any tab to wake it; the next `chrome.alarms` tick re-syncs.
