#!/usr/bin/env bash
# Android on-device smoke suite for the QuranRoots mobile feasibility app.
#
# Drives the already-installed app on a running emulator/device using only
# adb + uiautomator (no paid tools, no instrumentation APK). Every assertion
# reads real UI Automator XML content or a real adb state read-back -- never
# a sleep alone, never a screenshot. See README.md in this directory for
# prerequisites, what each check actually proves, and known limitations.
#
# Usage: ./run.sh [output_dir]
# Exit code: 0 if every check passed, 1 otherwise.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"
CONTENT_DB="$SCRIPT_DIR/../../content-db/quran-content.sqlite"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

OUT_DIR="${1:-$(mktemp -d)}"
mkdir -p "$OUT_DIR"
log "dumps/output will be saved under: $OUT_DIR"

require_device
require_app_installed
if ! command -v sqlite3 >/dev/null 2>&1; then
  log "sqlite3 is required (reads expected ayah text from $CONTENT_DB) but was not found on PATH."
  exit 1
fi

# Restore the device's original airplane-mode state no matter how the
# script exits, so a failed run never leaves the emulator mid-toggle.
ORIGINAL_AIRPLANE_MODE="$(get_airplane_mode)"
log "original airplane-mode state: $ORIGINAL_AIRPLANE_MODE"
restore_airplane_mode() {
  local current
  current="$(get_airplane_mode)"
  if [ "$current" != "$ORIGINAL_AIRPLANE_MODE" ]; then
    local restore_cmd="disable"
    [ "$ORIGINAL_AIRPLANE_MODE" = "enabled" ] && restore_cmd="enable"
    log "restoring airplane-mode to original state ($ORIGINAL_AIRPLANE_MODE)"
    adb shell cmd connectivity airplane-mode "$restore_cmd" >/dev/null
  fi
}
trap restore_airplane_mode EXIT

# ---------------------------------------------------------------------------
# 1. Launch and home screen
# ---------------------------------------------------------------------------
log "--- 1. App launch and home screen ---"
adb shell am force-stop "$PKG"
sleep 1
adb shell am start -n "$ACTIVITY" >/dev/null
home_dump=$(dump_ui "01_home" "$OUT_DIR")
assert_text_present "$home_dump" "QuranRoots" "launch: app bar title"
assert_text_present "$home_dump" "Home" "launch: home tab"
assert_text_present "$home_dump" "Qur'an" "launch: quran tab"

# ---------------------------------------------------------------------------
# 2. Bottom navigation (Lessons, Practice, More, back to Home)
# ---------------------------------------------------------------------------
log "--- 2. Bottom navigation ---"
tap_on_text "$home_dump" "Lessons"
lessons_dump=$(dump_ui "02_lessons" "$OUT_DIR")
assert_text_present "$lessons_dump" "Levels" "nav: Lessons shows Levels"
assert_changed "$home_dump" "$lessons_dump" "nav: Home -> Lessons changed screen"

tap_on_text "$lessons_dump" "Practice"
practice_dump=$(dump_ui "03_practice" "$OUT_DIR")
assert_text_present "$practice_dump" "Practice" "nav: Practice tab loaded"
assert_changed "$lessons_dump" "$practice_dump" "nav: Lessons -> Practice changed screen"

tap_on_text "$practice_dump" "More"
more_dump=$(dump_ui "04_more" "$OUT_DIR")
assert_text_present "$more_dump" "Settings" "nav: More shows Settings row"
# Memorization is a deliberately deferred feature (confirmed in
# mobile/src/screens/MoreScreen.tsx), not a bug -- asserting its
# "Coming Soon" label present is itself the correct expectation today.
assert_text_present "$more_dump" "Coming Soon" "nav: Memorization marked Coming Soon (expected, not implemented yet)"

tap_on_text "$more_dump" "Home"
home_dump_2=$(dump_ui "05_home_again" "$OUT_DIR")
assert_text_present "$home_dump_2" "Qur'an" "nav: back to Home"

# ---------------------------------------------------------------------------
# 3. Surah browsing and reading (Arabic / English / French)
# ---------------------------------------------------------------------------
log "--- 3. Surah browsing and reading ---"
tap_on_text "$home_dump_2" "Qur'an"
quran_list_dump=$(dump_ui "06_quran_list" "$OUT_DIR")
assert_text_present "$quran_list_dump" "Al-Fatiha" "surah list: Al-Fatiha present"
assert_changed "$home_dump_2" "$quran_list_dump" "surah list: navigated from Home"

# Expected text for Al-Fatiha 1:1 is read from the real bundled content DB
# at run time rather than hardcoded here: a literal Arabic string in this
# file is not guaranteed to be byte-identical to the rendered text (Arabic
# combining diacritics -- e.g. shadda+fatha -- can be stacked in more than
# one valid Unicode order; a hand-typed literal silently mismatched the
# device's actual rendering order during development of this suite).
# Reading from the DB ties the assertion to the real content instead.
expected_arabic=$(sqlite3 "$CONTENT_DB" "SELECT arabic_text FROM ayahs WHERE surah_number=1 AND ayah_number=1;")
expected_english=$(sqlite3 "$CONTENT_DB" "
  SELECT t.text FROM translations t
  JOIN content_sources cs ON cs.id = t.source_id
  WHERE cs.translator='Marmaduke Pickthall' AND t.surah_number=1 AND t.ayah_number=1;")
expected_french=$(sqlite3 "$CONTENT_DB" "
  SELECT ts.text FROM translation_segment_ayahs tsa
  JOIN translation_segments ts ON ts.id = tsa.segment_id
  WHERE tsa.surah_number=1 AND tsa.ayah_number=1;")

tap_on_text "$quran_list_dump" "Al-Fatiha"
reading_ar_dump=$(dump_ui "07_reading_arabic" "$OUT_DIR")
assert_text_present "$reading_ar_dump" "Al-Fatiha" "reading: surah title shown"
assert_text_present "$reading_ar_dump" "$expected_arabic" "reading: Arabic text renders (matches content DB)"

tap_on_text "$reading_ar_dump" "English"
reading_en_dump=$(dump_ui "08_reading_english" "$OUT_DIR")
assert_text_present "$reading_en_dump" "$expected_english" "reading: English (Pickthall) text renders (matches content DB)"

tap_on_text "$reading_en_dump" "French"
reading_fr_dump=$(dump_ui "09_reading_french" "$OUT_DIR")
assert_text_present "$reading_fr_dump" "$expected_french" "reading: French (Kazimirski) text renders (matches content DB)"

# ---------------------------------------------------------------------------
# 4. Offline behavior -- real network-state change, not just an icon
# ---------------------------------------------------------------------------
log "--- 4. Offline behavior ---"
set_airplane_mode "enable" "offline: airplane mode turns on"
offline_dump=$(dump_ui "10_offline_still_reading" "$OUT_DIR")
# The app makes zero network calls of any kind (confirmed in the Phase 3
# audit via code review and the existing offline.spec.ts assertion), so the
# correct, expected result here is that nothing changes or breaks -- the
# same French text must still be fully rendered with the device genuinely
# offline, not just assumed to still work.
assert_text_present "$offline_dump" "$expected_french" "offline: content still renders with airplane mode on"
set_airplane_mode "disable" "offline: airplane mode turns back off"

# ---------------------------------------------------------------------------
# 5. Restart behavior (known characteristic, not a failure condition)
# ---------------------------------------------------------------------------
log "--- 5. Restart and state persistence ---"
adb shell am force-stop "$PKG"
sleep 1
adb shell am start -n "$ACTIVITY" >/dev/null
restart_dump=$(dump_ui "11_after_restart" "$OUT_DIR")
# Documented finding from the Android audit: the app always cold-boots to
# Home after force-stop/relaunch -- it does not restore the screen the user
# was on (here, the Qur'an reading screen). This assertion documents that
# real, verified behavior; it is not a bug fix target by itself and should
# not be read as a failure of this suite.
assert_text_present "$restart_dump" "Home" "restart: app cold-boots to Home (known behavior -- does not restore prior screen)"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "--- SMOKE SUITE COMPLETE: $PASS_COUNT passed, $FAIL_COUNT failed ---"
log "dumps saved under: $OUT_DIR"
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
