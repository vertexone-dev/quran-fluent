import XCTest

/// QR-DESIGN-004B: minimal iOS smoke + safe-area checks. No third-party
/// dependencies. Screenshots are written to $SHOT_DIR when set (pass it to
/// xcodebuild as TEST_RUNNER_SHOT_DIR), and are always attached to the result.
final class SafeAreaSmokeTests: XCTestCase {
    let app = XCUIApplication()
    // Dynamic Island / status bar zone on notched iPhones is ~59pt tall.
    let minContentY: CGFloat = 54

    override func setUp() {
        continueAfterFailure = true
        app.launchArguments += ["-AppleLanguages", "(en)"]
        app.launch()
    }

    private func shot(_ name: String) {
        let s = XCUIScreen.main.screenshot()
        let a = XCTAttachment(screenshot: s)
        a.name = name; a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    /// Every visible text / button must sit below the status bar / island.
    private func assertBelowStatusBar(_ screen: String) {
        for q in [app.staticTexts, app.buttons] {
            for el in q.allElementsBoundByIndex where el.exists && el.frame.height > 0 {
                let f = el.frame
                // ignore elements scrolled off the top by a sticky header
                if f.maxY <= 0 { continue }
                XCTAssertGreaterThanOrEqual(f.minY, minContentY,
                    "\(screen): '\(el.label)' at y=\(f.minY) overlaps the status bar / Dynamic Island")
            }
        }
    }

    private func openTab(_ label: String) {
        let b = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", label)).firstMatch
        XCTAssertTrue(b.waitForExistence(timeout: 8), "tab '\(label)' missing")
        b.tap()
    }

    func testOnboardingAndTabs() {
        // Fresh install shows onboarding; a re-run on an existing install skips it.
        // Run `xcrun simctl uninstall <udid> <bundle id>` first to force the fresh path.
        let start = app.buttons["Get started"]
        if start.waitForExistence(timeout: 15) {
            XCTAssertTrue(app.staticTexts["Welcome to QuranRoots"].exists)
            assertBelowStatusBar("Onboarding")
            shot("ios-01-onboarding")
            start.tap()
        }

        for (i, tab) in ["Home", "Qur'an", "Learn", "Progress", "Settings"].enumerated() {
            openTab(tab)
            sleep(2)
            assertBelowStatusBar(tab)
            shot(String(format: "ios-%02d-%@", i + 2, tab.replacingOccurrences(of: "'", with: "")))
        }

        // Reader: open Al-Fatiha from the Surah list.
        openTab("Qur'an")
        let row = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Al-Fatiha")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 8))
        row.tap()
        sleep(2)
        assertBelowStatusBar("Reader")
        shot("ios-07-reader")
    }
}
