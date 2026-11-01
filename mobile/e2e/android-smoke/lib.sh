#!/usr/bin/env bash
# Shared adb/UI Automator helpers for the Android on-device smoke suite.
# Sourced by run.sh -- not meant to be executed directly.
#
# Every assertion here reads real UI Automator XML content (what's actually
# on screen, via the accessibility tree) or a real adb state read-back.
# Nothing asserts on a sleep alone, and nothing asserts on a screenshot.

PKG="${PKG:-com.quranroots.mobilefeasibility}"
ACTIVITY="${ACTIVITY:-$PKG/.MainActivity}"

PASS_COUNT=0
FAIL_COUNT=0

log() { echo "[$(date +%H:%M:%S)] $*" >&2; }

# dump_ui <label> <out_dir>
# Pulls a fresh UI Automator XML dump to <out_dir>/<label>.xml and prints its
# path. Polls because the app's Capacitor WebView reports an empty/NAF
# ("not accessibility friendly") tree for roughly 1-3s right after launch or
# a tab switch, before content paints -- a fixed sleep is not reliable here.
# An empty/loading dump is ~2.6KB; every populated screen observed so far is
# 7KB or larger, so 4000 bytes is used as the "still loading" threshold.
dump_ui() {
  local label="$1" out_dir="$2"
  local dest="$out_dir/${label}.xml"
  local tries=0 size=0 max_tries=10
  while [ "$tries" -lt "$max_tries" ]; do
    adb shell uiautomator dump /sdcard/window_dump.xml >/dev/null
    adb pull /sdcard/window_dump.xml "$dest" >/dev/null 2>&1
    size=$(wc -c <"$dest" | tr -d ' ')
    if [ "$size" -gt 4000 ]; then
      break
    fi
    tries=$((tries + 1))
    sleep 1
  done
  log "dump_ui($label): $dest (${size} bytes, waited ${tries}s)"
  echo "$dest"
}

# assert_text_present <dump_file> <text> <step_name>
# Substring match within a text="..." attribute value, not a prefix match:
# several real screens concatenate an icon glyph or arrow directly onto the
# label in one text node (observed: "text=\"⚙Settings→\"", one node, no
# separator), so anchoring at the start of the quoted value would miss them.
assert_text_present() {
  local dump_file="$1" text="$2" step="$3"
  if grep -q "text=\"[^\"]*${text}" "$dump_file"; then
    log "PASS [$step]: '$text' present in $(basename "$dump_file")"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    log "FAIL [$step]: '$text' NOT found in $(basename "$dump_file")"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

# assert_changed <dump_a> <dump_b> <step_name>
# Deterministic "screen changed" check: compares the sorted set of
# text="..." values between two dumps. Passes only if the sets differ --
# not just byte size, which can be noisy from whitespace/ordering alone.
assert_changed() {
  local a="$1" b="$2" step="$3"
  local ta tb
  ta=$(grep -o 'text="[^"]*"' "$a" | sort -u)
  tb=$(grep -o 'text="[^"]*"' "$b" | sort -u)
  if [ "$ta" != "$tb" ]; then
    log "PASS [$step]: screen content changed between $(basename "$a") and $(basename "$b")"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    log "FAIL [$step]: screen content identical between $(basename "$a") and $(basename "$b")"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

# tap_on_text <dump_file> <text>
# Finds the bounds="[x1,y1][x2,y2]" of the first node with this exact text
# and taps its center. Resource-id-free, matching how the app is already
# driven by visible text in mobile/e2e/offline.spec.ts (Playwright).
tap_on_text() {
  local dump_file="$1" text="$2"
  local coords
  coords=$(python3 -I -c "
import re, sys
dump_file, text = sys.argv[1], sys.argv[2]
data = open(dump_file).read()
m = re.search(r'text=\"' + re.escape(text) + r'\"[^>]*bounds=\"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]\"', data)
if not m:
    sys.exit(1)
x1, y1, x2, y2 = (int(g) for g in m.groups())
print((x1 + x2) // 2, (y1 + y2) // 2)
" "$dump_file" "$text")
  if [ -z "$coords" ]; then
    log "tap_on_text('$text'): FAILED to locate node in $(basename "$dump_file")"
    return 1
  fi
  local cx cy
  read -r cx cy <<<"$coords"
  log "tap_on_text('$text'): tapping ($cx, $cy)"
  adb shell input tap "$cx" "$cy"
}

# get_airplane_mode: prints "enabled" or "disabled", read from the device.
get_airplane_mode() {
  adb shell cmd connectivity airplane-mode | tr -d '\r\n'
}

# set_airplane_mode <enable|disable> <step_name>
# Changes the real device network state, then reads it back to confirm the
# change actually happened -- never just assumes the command worked. This
# is what distinguishes this check from "looks offline" (an icon) from
# "is offline" (the OS's own connectivity state).
set_airplane_mode() {
  local desired="$1" step="$2"
  adb shell cmd connectivity airplane-mode "$desired" >/dev/null
  sleep 1
  local actual
  actual=$(get_airplane_mode)
  local expected
  [ "$desired" = "enable" ] && expected="enabled" || expected="disabled"
  if [ "$actual" = "$expected" ]; then
    log "PASS [$step]: airplane-mode read back as '$actual' after requesting '$desired'"
    PASS_COUNT=$((PASS_COUNT + 1))
    return 0
  else
    log "FAIL [$step]: airplane-mode read back as '$actual', expected '$expected'"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return 1
  fi
}

require_device() {
  local line
  line=$(adb devices -l | sed -n '2p')
  if [ -z "$line" ]; then
    log "No device/emulator attached. Start the Pixel_9 (API 35) AVD first."
    exit 1
  fi
  log "device: $line"
}

require_app_installed() {
  if ! adb shell pm list packages | grep -q "package:$PKG"; then
    log "$PKG is not installed on the attached device/emulator."
    exit 1
  fi
}
