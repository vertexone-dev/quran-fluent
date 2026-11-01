# Android on-device smoke suite

Drives the real, already-installed QuranRoots mobile app on a real Android
emulator/device using nothing but `adb` and `uiautomator` — no paid tools,
no Espresso/instrumentation APK, no new build step. This is **not** a
replacement for `mobile/e2e/*.spec.ts` (Playwright, desktop Chromium
against the web bundle) — it is deliberately separate, narrower coverage
that proves the same flows work in the real installed app, in a real
Android WebView, on a real device. Do not cite the Playwright suite as
evidence of on-device Android behavior, and do not cite this suite as a
replacement for the Playwright suite's broader web-level coverage.

Every assertion here reads either:
- real UI Automator XML (the accessibility tree actually on screen right
  now), or
- a real `adb` state read-back (e.g. the OS's own airplane-mode state after
  changing it),

never a screenshot and never a fixed sleep alone.

## Prerequisites

- A running Android emulator or attached device with the app already
  installed (`com.quranroots.mobilefeasibility`). This suite does not start
  an emulator or install the app — it only drives what's already there.
  - To start the known-good AVD used during development: `emulator -avd
    Pixel_9` (Android 15 / API 35), then install with `cd mobile/android &&
    ./gradlew installDebug`.
- `adb` on `PATH`, or `ANDROID_HOME` set so the script can find
  `$ANDROID_HOME/platform-tools/adb` itself (defaults to
  `~/Library/Android/sdk` if `ANDROID_HOME` isn't set).
- `python3` on `PATH` (used only for parsing `bounds="[x1,y1][x2,y2]"` out
  of the UI Automator XML — no third-party packages, stdlib only).
- `sqlite3` on `PATH` (used to read the *expected* Arabic/English/French
  text for Al-Fatiha 1:1 directly from the real bundled content database at
  `mobile/content-db/quran-content.sqlite`, instead of hardcoding a literal
  string in this suite — see "Why text is read from the database" below).

## Running it

```sh
# from the repo root, or from mobile/e2e/android-smoke/
./mobile/e2e/android-smoke/run.sh [output_dir]
```

`output_dir` is optional (defaults to a fresh `mktemp -d`); every UI dump
taken during the run is saved there as a numbered `.xml` file, so a failure
can be inspected afterward with a plain text search — no trace viewer
needed.

Exit code is `0` only if every check passed, `1` otherwise. Nothing is
installed, built, committed, or pushed by this script.

## What it checks

1. **App launch and home screen** — force-stop, relaunch, confirm the app
   bar title and both the Home/Qur'an tabs are present.
2. **Bottom navigation** — Home → Lessons → Practice → More → Home,
   asserting each tab's expected content loads and that the screen content
   genuinely changes each time (a diff of the full set of visible text
   nodes, not just a byte-size check).
3. **Surah browsing and reading** — Home → Qur'an tab → surah list → open
   Al-Fatiha → confirm the real Arabic text renders → switch to English →
   confirm the real Pickthall text renders → switch to French → confirm the
   real Kazimirski text renders.
4. **Offline behavior** — turns the device's real airplane mode on (with a
   read-back confirming the OS state actually changed, not just that the
   command was sent), confirms the same content is still fully rendered,
   then turns it back off (read-back confirmed again). The app makes zero
   network calls in normal operation (confirmed separately in the Android
   audit), so the correct expected result is "nothing breaks," which this
   check verifies directly rather than assuming.
5. **Restart behavior** — force-stop and relaunch, confirm the app lands on
   the Home screen. This documents a real, verified characteristic: **the
   app always cold-boots to Home and does not restore the screen the user
   was on before the restart.** That's reported here as a fact about
   today's behavior, not treated as a suite failure — if that's later
   fixed, update this assertion to match the new, intended behavior.

The suite restores the device's original airplane-mode state on exit even
if a check fails partway through (`trap ... EXIT`), so a failed run never
leaves the emulator mid-toggle.

## Why text is read from the database, not hardcoded

An earlier version of this suite hardcoded the expected Arabic string for
Al-Fatiha 1:1 as a literal in the script. It failed — not because the app
was wrong, but because Arabic combining diacritics (here, shadda and fatha
stacked on the same base letter) can be validly ordered more than one way
in Unicode, and the hand-typed literal happened to use a different stacking
order than what's actually in the content database and rendered on screen.
Reading the expected Arabic/English/French text live from
`mobile/content-db/quran-content.sqlite` at run time avoids this entire
class of mismatch and ties the assertion to the real content instead of a
guess at it.

## Known limitations / what this does NOT cover yet

- **Deeper interaction**: opening a specific lesson, answering an exercise,
  toggling a Settings switch, and Surah next/prev navigation were all
  manually verified as feasible with the same adb+uiautomator approach
  during the Android audit, but are not yet encoded here — add them only
  after verifying the exact tap targets/assertions live against the
  emulator first, the same way every check above was verified before being
  written down (see the audit report for the methodology).
- **Audio and authentication/sync**: not covered because neither feature
  exists in the app yet (confirmed deliberate Phase 1 scope cuts, not a
  gap in this suite).
- **Fine-grained gesture/animation/timing checks** and **anything that
  needs to inspect state invisible to the accessibility tree** (e.g. exact
  `localStorage` contents) are out of scope for black-box adb driving —
  that would need a real Espresso/`androidTest` module instead.
- **Resolution/density dependence**: tap coordinates are computed from the
  live UI dump's own `bounds`, not hardcoded pixel values, so this should
  survive minor layout shifts — but it has only been run against the
  Pixel 9 / API 35 emulator at its default resolution. A meaningfully
  different screen size/density has not been verified.
- This suite is intentionally not wired into CI yet — it requires a live
  emulator/device, which most CI runners don't have without extra setup
  (e.g. a GitHub Actions Android emulator runner). Treat it as a local,
  manually-run regression check until/unless that's set up deliberately.

## Upgrade path

If this grows past a handful of checks, free YAML-based
[Maestro](https://maestro.mobile.dev/) (MIT-licensed, drives via the same
UI Automator mechanism under the hood) is a smaller step up than a full
Espresso/`androidTest` module and was recommended during the audit as the
next tier. It is not installed or used here.
