# Privacy Policy — Fat Orange Cat

_Last updated: 2026-04-29_

Fat Orange Cat is a Chrome extension that enforces pomodoro-style breaks
with a full-screen overlay. This policy describes everything the extension
does (and does not do) with data.

## TL;DR

The extension does **not** collect, transmit, or sell any personal
information. All data lives in your browser (`chrome.storage.local`),
on your machine. There are no servers, no analytics, no trackers, no
remote code, and no network requests.

## What the extension stores

The extension persists exactly two records in `chrome.storage.local`:

| Key | Fields | Purpose |
| --- | --- | --- |
| `settings` | `workMinutes` (1–120), `enabled` (boolean) | Your chosen work-block length and the on/off toggle. |
| `state` | `phase` (`idle` / `work` / `break`), `phaseEndsAt` (timestamp), `workStreakStartedAt` (timestamp or null), `breakStartedAt` (timestamp or null) | The current pomodoro cycle so the timer survives browser restarts. |

That is the complete list. Nothing else is written to storage. None of
these fields contains personal information, browsing history, page
content, or anything tied to your identity.

`chrome.storage.local` is a per-installation key/value store managed by
Chrome. It is **not** synced across devices, and it never leaves your
machine. Uninstalling the extension or clearing its site data deletes
all of it.

## What the extension reads at runtime

To put the cat overlay on every browser tab during a break, the
extension queries the list of currently open tabs (`chrome.tabs.query`)
and reads each tab's URL. The URL is used **only** to decide whether
Chrome will allow script injection (some pages — `chrome://`,
`chrome-extension://`, the Chrome Web Store, `view-source://` — refuse
content scripts and are skipped). URLs are not stored, logged,
transmitted, or analyzed in any way.

The extension does **not** read page content, form fields, cookies,
passwords, browsing history, bookmarks, or any other browsing data.

## Network usage

None. The extension makes zero network requests. It does not contact
any first-party server (there is none) and does not contact any
third-party service. It bundles no analytics SDK, no error reporter,
no advertising library. All code runs locally inside Chrome.

You can verify this by inspecting the source ([content.js](content.js),
[background.js](background.js), [popup.js](popup.js)) — there are no
`fetch`, `XMLHttpRequest`, `WebSocket`, or `navigator.sendBeacon` calls.

## Permissions and why each one is needed

The extension declares the minimum permissions required to do its job:

| Permission | What it lets the extension do | Why this extension needs it |
| --- | --- | --- |
| `storage` | Read/write `chrome.storage.local`. | Persist your work-block length and the timer state across browser restarts. |
| `alarms` | Schedule wake-ups via `chrome.alarms`. | Fire `cat-phase-end` when the work block ends so the break begins on time, even if the service worker has been suspended. |
| `tabs` | Enumerate open tabs and send messages to them. | Show the cat overlay on every tab simultaneously, and update the per-tab countdown each second. |
| `scripting` | Inject `content.js` and `overlay.css` into a tab. | Cover tabs that were already open before the extension was installed (the manifest's auto-injection only fires on new page loads). |
| `host_permissions: <all_urls>` | Inject content scripts into any web origin. | The cat must appear on every tab no matter what site you happen to be on. The extension does not read or transmit page content; the broad permission is purely so the overlay reaches every tab. |

## Data sharing

The extension does not share any data with anyone, because it does not
collect any. There are no analytics partners, no advertisers, no
back-end service, and no log files outside your local machine.

## Children's privacy

The extension does not knowingly collect data from anyone, including
children under 13.

## Changes to this policy

If a future version of the extension changes what it stores, sends, or
reads, this file will be updated and the version number in
[manifest.json](manifest.json) will be bumped in the same release.
The policy text shipped with each version reflects the behavior of
that version.

## Contact

For privacy questions, open an issue on the project's GitHub
repository, or contact the maintainer at the email address listed on
the Chrome Web Store listing.
