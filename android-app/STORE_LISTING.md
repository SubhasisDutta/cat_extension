# Play Store listing — Fat Orange Cat

Copy-paste-ready text for each field in the Play Console listing form,
plus the policy disclosures Google requires for the permissions this
app uses.

When you create the listing for the first time:
<https://play.google.com/console/> → **Create app**.

---

## App details

**App name** (max 30 chars)

```
Fat Orange Cat
```

**Short description** (max 80 chars)

```
He sits on your screen for 5 minutes after every work block. He is not sorry.
```

**Full description** (max 4000 chars)

```
Fat Orange Cat is a pomodoro timer that does not negotiate.

After every 25-minute work block (configurable 1–120), an annoyed orange cat
draws himself across your entire screen for a 5-minute break. He covers
whatever app you're in. You cannot tap through him. You cannot scroll past
him. Pressing Home does not dismiss him. He is on top of the OS window
manager, and he is not moving.

The longer you go without completing a break, the fatter he gets:

  • smug (under 1 hour) — small, judgmental
  • chunky (1–2 hours)
  • rotund (2–3 hours)
  • obscene (3–5 hours) — half the screen
  • eclipse (5+ hours) — you cannot see your code anymore

The only way to shrink him is to actually take a break. Disabling the app
does not count. Closing it does not count. He resets when, and only when,
the 5-minute break completes.

Thirty seconds before he arrives, you get a notification: FAT CAT INCOMING.
Save your work.

What he does NOT do:

  • does not read the screen of other apps
  • does not read your messages, contacts, location, accounts, photos
  • does not connect to the internet
  • does not phone home, run analytics, or load remote code
  • does not show ads
  • does not have a subscription, paywall, or in-app purchase

Source code: https://github.com/SubhasisDutta/cat_extension
Privacy: https://github.com/SubhasisDutta/cat_extension/blob/main/android-app/PRIVACY.md

Permissions in plain English:

  • Display over other apps — required. This is what lets him draw on top
    of whatever you're using. Without it, he only shows inside Fat Orange
    Cat itself, which defeats the point.
  • Exact alarms — required. Phase boundaries must fire on time, not when
    Android decides it's convenient.
  • Notifications — recommended. The 30-second pre-break warning is a
    notification.
  • Run after reboot — required. He doesn't get to take a break just
    because you rebooted.

There is no premium tier. There is no cloud. There is one feature, and he
is the feature. Companion to the Chrome extension of the same name.
```

**App icon** — `app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` (the
foreground vector + orange background). Play Console will rasterize a
512×512 PNG from it during upload, OR you can upload an explicit
512×512 master separately.

**Feature graphic** (1024×500) — TODO. Suggested composition: orange
background, the cat SVG centered on the right two-thirds, the wordmark
"FAT ORANGE CAT" in dark brown on the left. Must not contain
controller / store-icon mockups, and must not be a photo of a real cat
(Play policy).

**Phone screenshots** (at least 2, max 8; 1080×1920 or 1080×2400)

Required scenes (numbered to match `screenshots/` dir when populated):

1. **Settings screen, idle** — full Compose UI, status card showing
   "Off duty", settings card showing 25 / Cat is on duty.
2. **Settings screen, active work block** — same layout, status card
   shows "Working" with a 24:30 countdown and weight = chunky.
3. **30-second warning notification** — drag-down notification panel
   showing "FAT CAT INCOMING" + "Save your work. He arrives in 0:30."
4. **The cat at full overlay** — the system overlay during a break,
   on top of (e.g.) the Android settings app, with timer 4:55 and a
   rotating phrase.
5. **Eclipse stage cat** — the cat at sizeFactor 0.85, label "eclipse
   cat • 5.0h streak". Hard to see anything else.

Take these on a Pixel 6+ at 1080×2400. Do NOT add device frames —
Play Console adds them automatically.

**Tablet screenshots** (optional, 1080×1920 or larger) — TODO.
Optional for v1.

---

## App access

Q: Is all functionality available without restrictions?
A: **Yes.**

Q: Login required to use the app?
A: **No.**

Q: Is any feature behind a paywall, subscription, or trial?
A: **No.**

---

## Ads

Q: Does your app contain ads?
A: **No.**

---

## Content rating

Walk through the IARC questionnaire (Play Console will guide you). For
Fat Orange Cat the answers are all "no" — no violence, no nudity, no
gambling, no drugs, no controlled substances, no user-generated content.
Expected rating: **Everyone (3+)**.

---

## Target audience and content

- Age groups: **18+**. (We're not designing for children, even though
  the rating would technically be Everyone.)
- Appeals to children?: **No.**

---

## Data safety form

Play Console requires a Data Safety declaration. Fill it in literally:

- **Does your app collect or share any of the required user data types?**
  → **No.**
- **Is all of the user data collected by your app encrypted in transit?**
  → N/A (no data collected).
- **Do you provide a way for users to request that their data is
  deleted?**
  → N/A (no data collected). The app stores everything locally;
  uninstall removes it.

If Play asks for a privacy policy URL anyway, link to:
`https://github.com/SubhasisDutta/cat_extension/blob/main/android-app/PRIVACY.md`

---

## Permissions disclosures

Three of the permissions we declare have specific Play Store policies
that require explicit disclosure. Use this text in the Console.

### `SYSTEM_ALERT_WINDOW` ("Display over other apps")

Pre-disclosure to show on first run (handled by Android automatically
when the app calls `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`):

> Fat Orange Cat draws an annoyed cat on top of other apps for 5
> minutes after each work block. The overlay does not read the
> contents of underlying apps; it only blocks input until the break
> finishes. You can revoke this permission anytime from Settings →
> Apps → Special access → Display over other apps.

### `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`

Justification text for the Console's exact-alarm policy form:

> Fat Orange Cat is a pomodoro timer. Exact alarms are used to fire
> the work-block→break and break→work transitions on time. Without
> exact alarms, the cat may arrive several minutes late on a Doze-mode
> device, breaking the user's expectation that breaks happen at fixed
> intervals.

This is the exact use case Google's policy lists as **eligible** for
exact alarms.

### `FOREGROUND_SERVICE_SPECIAL_USE`

The manifest declares the subtype as `pomodoro_break_overlay_timer`.
In the Console's "Foreground service" disclosure form:

> The foreground service runs the pomodoro timer (work / break phase
> machine) and updates the user's notification with the current
> countdown. It is required because Android cancels alarms and stops
> processes whose work is not declared as foreground; canceling the
> timer would silently break the app's core function.

### `RECEIVE_BOOT_COMPLETED`

No specific disclosure required, but Play sometimes asks. Justification:

> The app re-arms its timer after a device reboot if the user had it
> enabled. Without this, a reboot during a multi-day work streak would
> silently disable the timer and the user's "fat cat" weight would
> stall instead of advancing.

### `POST_NOTIFICATIONS`

Standard Android 13+ runtime permission; no Console-specific text
required.

---

## Release notes (per upload)

For the first upload (versionCode = 1, versionName = 0.1.0):

```
First public release.

  • 25-minute work blocks (configurable 1–120) followed by a 5-minute break
  • Cat overlay on top of every app during a break; cannot be dismissed
  • Weight stages: smug → chunky → rotund → obscene → eclipse
  • Streak only resets when a break actually completes
  • 30-second pre-break notification so you can save your work

Companion to the Chrome extension of the same name.
```

For subsequent uploads, write 1–3 bullets describing what changed. Keep
the personality — terse, slightly annoyed, no apologies.

---

## Pre-launch checklist

- [ ] App name, short description, full description filled in.
- [ ] Privacy policy URL points to a publicly readable URL.
- [ ] Phone screenshots (≥2) uploaded.
- [ ] Feature graphic uploaded (1024×500, no device frames).
- [ ] App icon: 512×512 master uploaded or auto-generated from
      adaptive icon.
- [ ] Content rating: questionnaire complete, IARC certificate issued.
- [ ] Target audience: 18+ selected.
- [ ] Data safety form: declared "no data collected".
- [ ] `SCHEDULE_EXACT_ALARM` and `FOREGROUND_SERVICE_SPECIAL_USE`
      disclosures filled in.
- [ ] Pricing & distribution: free, country selection done.
- [ ] First AAB uploaded under Production / Internal testing.
- [ ] Test on at least one Android 12+ physical device.
- [ ] `git tag v0.1.0` after rollout completes.
