# Privacy Policy — Fat Orange Cat (Android)

_Last updated: 2026-05-09_

Fat Orange Cat is an Android app that enforces pomodoro-style breaks
with a full-screen overlay drawn over other apps. This policy describes
everything the app does (and does not do) with data.

## TL;DR

The app does **not** collect, transmit, or sell any personal information.
All data lives on your device, in app-private storage. There are no
servers, no analytics, no trackers, no remote code, and no network
requests.

## What the app stores

The app persists exactly two records in app-private `DataStore<Preferences>`:

| Store | Fields | Purpose |
| --- | --- | --- |
| `settings.preferences_pb` | `work_minutes` (1–120), `enabled` (boolean) | Your chosen work-block length and the on/off toggle. |
| `timer_state.preferences_pb` | `phase` (`IDLE` / `WORK` / `BREAK`), `phase_ends_at` (timestamp), `work_streak_started_at` (timestamp or 0), `break_started_at` (timestamp or 0) | The current pomodoro cycle so the timer survives device reboots. |

That is the complete list. Nothing else is written to storage. None of
these fields contains personal information, location, contacts, content
of other apps, or anything tied to your identity.

App-private DataStore is a per-installation key/value store managed by
Android. It lives in `/data/data/com.fatorangecat/files/datastore/` and
is **not** accessible to other apps. Uninstalling Fat Orange Cat deletes
all of it.

## What the app reads at runtime

The app does **not** read other apps, screen content, your accounts,
your contacts, your location, your camera, your microphone, your
clipboard, or any other personal sensor.

When the cat overlay is drawn over other apps, Android asks the windowing
system to put our window on top of whatever is currently on screen. The
app never sees what's underneath the overlay. The `SYSTEM_ALERT_WINDOW`
permission only grants the ability to draw on top — it does not grant
read access.

## Network usage

None. The app makes zero network requests. It does not contact any
first-party server (there is none) and does not contact any third-party
service. It bundles no analytics SDK, no crash reporter, no advertising
library. All code runs locally on your device.

You can verify this by inspecting the source — there are no `OkHttp`,
`HttpURLConnection`, `Retrofit`, `Volley`, or socket APIs anywhere in
the codebase. The single `WebView` (used to render the SVG cat) is
explicitly configured with `blockNetworkLoads = true` and only loads a
local HTML string built in-process.

## Permissions and why each one is needed

The app declares the minimum permissions required to do its job:

| Permission | What it lets the app do | Why this app needs it |
| --- | --- | --- |
| `SYSTEM_ALERT_WINDOW` ("Display over other apps") | Draw a window over other apps. | The whole point: the cat must cover whatever app you're in when a break starts. The app does not read the underlying screen. |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE` | Run a long-lived service with a notification. | Keeps the timer alive while the screen is off or you switch apps, so phase boundaries fire on time. The `specialUse` subtype is `pomodoro_break_overlay_timer`. |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Schedule wake-ups at an exact wall-clock time. | Fires `cat-phase-end` when the work block ends so the break begins on time, even if Android is in Doze mode. |
| `POST_NOTIFICATIONS` (Android 13+) | Show the ongoing service notification and the 30-second pre-break warning. | Shows the timer countdown at-a-glance and gives you a heads-up so you can save your work before the cat arrives. |
| `RECEIVE_BOOT_COMPLETED` | Run a one-shot receiver after device reboot. | Re-arms the timer if you had it enabled before reboot. The cat's promise survives restarts. |
| `WAKE_LOCK` | Brief CPU wake when an alarm fires. | Wakes the device just long enough to hand the alarm off to the foreground service. |

The app **does not** request: `INTERNET`, `ACCESS_NETWORK_STATE`,
`READ_CONTACTS`, `READ_SMS`, `READ_PHONE_STATE`, `ACCESS_*_LOCATION`,
`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `CAMERA`,
`RECORD_AUDIO`, `READ_LOGS`, `BIND_ACCESSIBILITY_SERVICE`, or
`PACKAGE_USAGE_STATS`. None of these are needed and granting them is
not requested.

## Data sharing

The app does not share any data with anyone, because it does not
collect any. There are no analytics partners, no advertisers, no
back-end service, and no log files outside your local device.

## Children's privacy

The app does not knowingly collect data from anyone, including children
under 13.

## Changes to this policy

If a future version of the app changes what it stores, sends, or reads,
this file will be updated and the `versionName` in
[app/build.gradle.kts](app/build.gradle.kts) will be bumped in the same
release. The policy text shipped with each version reflects the
behavior of that version.

## Contact

For privacy questions, open an issue on the project's GitHub repository
(<https://github.com/SubhasisDutta/cat_extension>), or contact the
maintainer at the email address listed on the Google Play Store
listing.
