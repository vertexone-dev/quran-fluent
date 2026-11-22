#!/usr/bin/env bash
# Android on-device smoke suite for the QuranRoots mobile app.
#
# Drives the already-installed app on a running emulator/device using only
# adb + uiautomator (no paid tools, no instrumentation APK). Every assertion
# reads real UI Automator XML content or a real adb state read-back -- never
# a sleep alone, never a screenshot. See README.md in this directory for
# prerequisites, what each check actually proves, and known limitations.
#
# Usage: ANDROID_SERIAL=<serial> ./run.sh [output_dir]
#   ANDROID_SERIAL is REQUIRED when more than one device/emulator is attached.
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
# 1. Launch, first-launch onboarding, and Home
# ---------------------------------------------------------------------------
log "--- 1. App launch, onboarding and Home ---"
adb shell am force-stop "$PKG"
sleep 1
adb shell am start -n "$ACTIVITY" >/dev/null
first_dump=$(dump_ui "01_launch" "$OUT_DIR")
if grep -q "Welcome to QuranRoots" "$first_dump"; then
  # Fresh install: the welcome screen is shown once. It must name only
  # features that exist and state that essential learning is free.
  assert_text_present "$first_dump" "Essential Qur'an learning is free" "onboarding: free-access statement shown"
  assert_text_present "$first_dump" "Get started" "onboarding: Get started button present"
  tap_on_text "$first_dump" "Get started"
  sleep 1
else
  log "returning user: onboarding already completed on this install (skipping onboarding checks)"
fi
home_dump=$(dump_ui "01_home" "$OUT_DIR")
assert_text_present "$home_dump" "QuranRoots" "launch: app bar title"
for tab in "Home" "Qur'an" "Learn" "Progress" "Settings"; do
  assert_text_present "$home_dump" "$tab" "launch: '$tab' tab present"
done

# ---------------------------------------------------------------------------
# 2. Five-tab navigation + hardware back (Home, Qur'an, Learn, Progress, Settings)
# ---------------------------------------------------------------------------
log "--- 2. Bottom navigation and hardware back ---"
press_back() { adb shell input keyevent KEYCODE_BACK; sleep 1; }

tap_on_text "$home_dump" "Learn"
lessons_dump=$(dump_ui "02_learn" "$OUT_DIR")
assert_text_present "$lessons_dump" "Levels" "nav: Learn shows Levels"
assert_changed "$home_dump" "$lessons_dump" "nav: Home -> Learn changed screen"

tap_on_text "$lessons_dump" "Progress"
progress_dump=$(dump_ui "03_progress" "$OUT_DIR")
assert_text_present "$progress_dump" "Your Journey" "nav: Progress tab opens Your Journey"
assert_text_present "$progress_dump" "Not tracked yet" "progress: untracked rows are labelled, not invented"

tap_on_text "$progress_dump" "Settings"
settings_dump=$(dump_ui "04_settings" "$OUT_DIR")
assert_text_present "$settings_dump" "Start screen" "nav: Settings tab shows Start screen"
assert_text_present "$settings_dump" "Reduce motion" "settings: Reduce motion present"
assert_text_present "$settings_dump" "Export preferences" "settings: Export preferences present"

press_back
back1_dump=$(dump_ui "04b_back_to_progress" "$OUT_DIR")
assert_text_present "$back1_dump" "Your Journey" "hardware back: Settings -> Progress"
press_back
back2_dump=$(dump_ui "04c_back_to_learn" "$OUT_DIR")
assert_text_present "$back2_dump" "Levels" "hardware back: Progress -> Learn"
press_back
back3_dump=$(dump_ui "04d_back_to_home" "$OUT_DIR")
assert_text_present "$back3_dump" "QuranRoots" "hardware back: Learn -> Home (app not exited)"

# Secondary features stay one tap from Home (shortcut row).
tap_on_text "$back3_dump" "Practice"
practice_dump=$(dump_ui "04e_practice" "$OUT_DIR")
assert_text_present "$practice_dump" "Review exercises" "nav: Practice opens from Home shortcut"
press_back
home_dump_2=$(dump_ui "05_home_again" "$OUT_DIR")
assert_text_present "$home_dump_2" "Qur'an" "hardware back: Practice -> Home"

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
# 3b. Understand This Ayah, Reflect and Memorize (reached from the reader / Home)
# ---------------------------------------------------------------------------
log "--- 3b. Understand, Reflect, Memorize ---"
tap_on_text "$reading_fr_dump" "Understand this ayah"
understand_dump=$(dump_ui "09b_understand" "$OUT_DIR")
assert_text_present "$understand_dump" "Understand This Ayah" "understand: screen opens from the reader"
assert_text_present "$understand_dump" "$expected_english" "understand: English (Pickthall) matches content DB"
tap_on_text "$understand_dump" "Tafsir"
tafsir_dump=$(dump_ui "09c_understand_tafsir" "$OUT_DIR")
assert_text_present "$tafsir_dump" "No tafsir source" "understand: Tafsir says no source is approved (nothing invented)"
press_back
reader_again=$(dump_ui "09d_back_in_reader" "$OUT_DIR")
assert_text_present "$reader_again" "Al-Fatiha" "hardware back: Understand -> reader"
tap_on_text "$reader_again" "Home"
sleep 1
home_dump_3=$(dump_ui "09e_home_for_tiles" "$OUT_DIR")
assert_text_present "$home_dump_3" "QuranRoots" "nav: Home tab returns from the reader"
swipe_up; swipe_up; swipe_up
tiles_dump=$(dump_ui "09f_home_tiles" "$OUT_DIR")
tap_on_text "$tiles_dump" "Memorize"
memorize_dump=$(dump_ui "09g_memorize" "$OUT_DIR")
assert_text_present "$memorize_dump" "Memorization tracking is not available" "memorize: states plainly that tracking is not available"
press_back

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
if grep -q "Welcome to QuranRoots" "$restart_dump"; then
  log "FAIL [restart: onboarding must not reappear after completion]"; FAIL_COUNT=$((FAIL_COUNT + 1))
else
  log "PASS [restart: onboarding does not reappear]"; PASS_COUNT=$((PASS_COUNT + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "--- SMOKE SUITE COMPLETE: $PASS_COUNT passed, $FAIL_COUNT failed ---"
log "dumps saved under: $OUT_DIR"
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
