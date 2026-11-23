#!/usr/bin/env bash
# QR-DESIGN-007C: Android system font scale check for the bottom tab bar.
#
# For each font scale (1.0 / 1.3 / 1.5 / 2.0) it relaunches the app, reads the
# live layout from the WebView over DevTools, and checks that all five tabs
# exist, no label is clipped, every tab is at least 44 CSS px in both directions,
# and tapping each tab (at coordinates derived from the page's own layout, not
# from UI Automator bounds, which are offset inside this WebView) makes that tab
# current. It runs in whatever UI language is active, so run it once per
# language (Settings -> Language). The font scale is restored on exit.
#
# Usage: ANDROID_SERIAL=<serial> ./font-scale.sh      (debug build, onboarding done)
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
require_device
ORIGINAL_SCALE="$(adb shell settings get system font_scale | tr -d '\r')"
trap 'adb shell settings put system font_scale "${ORIGINAL_SCALE/null/1.0}" >/dev/null' EXIT

PROBE='(()=>{const dpr=devicePixelRatio;return {root:document.documentElement.dir,zoom:document.documentElement.dataset.textZoom,tabs:Array.from(document.querySelectorAll(".tab-item")).map(e=>{const l=e.querySelector(".tab-label"),r=e.getBoundingClientRect();return {id:e.dataset.testid,text:l.textContent,clipped:l.scrollWidth>l.clientWidth+0.5,w:r.width,h:r.height,cx:Math.round((r.x+r.width/2)*dpr),cy:Math.round((r.y+r.height/2)*dpr)}})}})()'

connect() {
  local pid
  pid=$(adb shell cat /proc/net/unix | grep -o "webview_devtools_remote_[0-9]*" | head -1)
  [ -n "$pid" ] || { log "no debuggable WebView found (is this a debug build?)"; return 1; }
  adb forward tcp:9333 "localabstract:$pid" >/dev/null
}
eval_js() { node "$SCRIPT_DIR/cdp-eval.mjs" "$1"; }

for scale in 1.0 1.3 1.5 2.0; do
  log "--- font scale $scale ---"
  adb shell settings put system font_scale "$scale" >/dev/null
  adb shell am force-stop "$PKG"
  adb shell am start -n "$ACTIVITY" >/dev/null
  wait_for_app_ui 30 || true
  sleep 3
  connect || { FAIL_COUNT=$((FAIL_COUNT + 1)); continue; }
  json=$(eval_js "$PROBE")
  verdict=$(python3 -I -c '
import json, sys
d = json.loads(sys.argv[1] or "null")
if not d or len(d["tabs"]) != 5:
    print("FAIL|expected 5 tabs, found %d" % (len(d["tabs"]) if d else 0)); raise SystemExit
bad = [t["text"] for t in d["tabs"] if t["clipped"]]
small = [t["text"] for t in d["tabs"] if t["w"] < 44 or t["h"] < 44]
if bad: print("FAIL|clipped labels: %s" % bad)
elif small: print("FAIL|tabs under 44 CSS px: %s" % small)
else: print("PASS|5 tabs, none clipped, smallest %dx%d CSS px, text zoom %s" % (min(t["w"] for t in d["tabs"]), min(t["h"] for t in d["tabs"]), d["zoom"]))
' "$json")
  if [ "${verdict%%|*}" = PASS ]; then PASS_COUNT=$((PASS_COUNT + 1)); else FAIL_COUNT=$((FAIL_COUNT + 1)); fi
  log "${verdict%%|*} [font scale $scale: tab bar layout]: ${verdict#*|}"
  # Tap every tab and read back which one is current.
  for id in tab-quran tab-learn tab-progress tab-settings tab-home; do
    xy=$(python3 -I -c '
import json, sys
d = json.loads(sys.argv[1]); t = [x for x in d["tabs"] if x["id"] == sys.argv[2]][0]
print(t["cx"], t["cy"] + (2254 - d["tabs"][0]["cy"]))
' "$json" "$id")
    # shellcheck disable=SC2086
    adb shell input tap $xy
    sleep 2
    current=$(eval_js 'document.querySelector("[aria-current=page]")?.dataset.testid' | tr -d '"')
    if [ "$current" = "$id" ]; then
      PASS_COUNT=$((PASS_COUNT + 1)); log "PASS [font scale $scale: tapping $id navigates]"
    else
      FAIL_COUNT=$((FAIL_COUNT + 1)); log "FAIL [font scale $scale: tapping $id navigates]: current is '$current'"
    fi
  done
done
log "--- FONT SCALE CHECK COMPLETE: $PASS_COUNT passed, $FAIL_COUNT failed ---"
[ "$FAIL_COUNT" -eq 0 ]
