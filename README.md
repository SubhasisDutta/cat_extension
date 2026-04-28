# Fat Orange Cat

A Chrome extension that enforces pomodoro breaks via an annoyed, entitled,
unbothered orange cat. Every work block (default 25 min) the cat appears for
5 minutes and refuses to leave. Skip your breaks and he gets fatter.

## What he does

- Appears at 5:00 on the timer, stretches out by 4:47, then sits there breathing.
- Covers every open browser tab on every window.
- Cannot be clicked through, dismissed via Esc, or deleted from the DOM (the
  overlay re-installs itself if a page script tries to remove it).
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

### 2. First-run behavior

- The extension auto-starts a 25-minute work block as soon as it's loaded.
- Nothing visible happens during work time — the cat is silent.
- After 25 minutes, the cat appears as a full-page overlay on every open tab,
  with a 5:00 countdown.

### 3. During a break

- The overlay covers the whole viewport. You cannot click through it, scroll
  past it, or close the tab via Esc / Cmd-W (the in-page handler is blocked;
  browser-level shortcuts are still browser-level).
- The cat starts compact, stretches out over the first 13 seconds (5:00 → 4:47),
  then settles into a slow breathing animation.
- A rotating phrase appears under the timer. He is not sorry.
- When the timer hits 0:00, the overlay disappears and a fresh work block
  starts automatically.

### 4. Change the work interval

1. Click the Fat Orange Cat icon in the toolbar to open the popup.
2. Edit the **Work block (minutes)** field. Allowed range: 1–120.
3. Click **Save**.
4. The new value applies to the *next* work block. The currently-running block
   is not interrupted — finish it (or use **Summon him now**) to switch over.

### 5. Disable / re-enable

1. Open the popup.
2. Toggle **Cat is on duty** off. The timer stops immediately and any active
   overlay is removed.
3. Toggle it back on to start a fresh work cycle.

### 6. Test the cat without waiting

Click **Summon him now** in the popup. This ends the current work block
immediately and triggers a real 5-minute break overlay. Useful for demos, QA,
or when you just need a forced pause.

### 7. Watch the cat get fatter

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

Covers timer math, weight progression, the stretch animation curve, the
phase state machine (idle → work → break → work), input clamping, and the
end-to-end scenarios from the spec (5h streak → eclipse stage, break
completion as the only weight reset path).

## Files

- [manifest.json](manifest.json) — MV3 manifest
- [background.js](background.js) — service worker, alarms, state, broadcast
- [content.js](content.js) — per-tab overlay + tamper defenses
- [cat.js](cat.js) — SVG art + personality phrases
- [lib/timer-logic.js](lib/timer-logic.js) — pure logic (testable in node)
- [overlay.css](overlay.css) — overlay styles
- [popup.html](popup.html), [popup.js](popup.js), [popup.css](popup.css) — settings UI
- [tests/](tests/) — no-deps test runner
- [CLAUDE.md](CLAUDE.md) — guidance for Claude Code working in this repo
- [AGENTS.md](AGENTS.md) — operating notes for autonomous coding agents

## Troubleshooting

- **Cat doesn't appear**: open the popup — is "Cat is on duty" on? Is a work
  block actively counting down? Try **Summon him now**.
- **Cat appears on most sites but not one specific site**: a few pages
  (`chrome://`, the Chrome Web Store, some PDFs) block content scripts. This
  is enforced by Chrome and cannot be overridden by extensions.
- **Cat disappears mid-break**: shouldn't happen — file an issue with the URL.
  The `MutationObserver` re-attach should keep it pinned.
- **Timer drifts after laptop sleep**: the service worker may have been
  suspended. Open any tab to wake it; the next `chrome.alarms` tick re-syncs.
