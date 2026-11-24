# AppUITests (QR-DESIGN-004B/004C)

Dependency-free XCUITest smoke: onboarding, five tabs, Reader, safe-area and
horizontal-overflow checks in English, French and Arabic (RTL). No signing needed
for the simulator.

```sh
U=<simulator udid>
for T in testEnglishOnboardingTabsAndReader testFrench testArabicRTL; do
  xcrun simctl uninstall $U com.quranroots.mobilefeasibility   # fresh install = English default
  TEST_RUNNER_SHOT_DIR=/path/to/shots xcodebuild test -project App.xcodeproj \
    -scheme AppUITests -destination "id=$U" CODE_SIGNING_ALLOWED=NO \
    -only-testing:AppUITests/SafeAreaSmokeTests/$T
done
```

Run `npm run build && npx cap sync ios` in `mobile/` first. Switching the in-app
language back to English (AR -> EN wrap) is not covered here.
