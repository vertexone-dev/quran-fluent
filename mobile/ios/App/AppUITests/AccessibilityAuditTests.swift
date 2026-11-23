import XCTest

/// QR-DESIGN-005: accessibility audit (VoiceOver labels + order, touch targets,
/// landscape, Dynamic Type). Writes findings to $SHOT_DIR/findings-*.txt (pass
/// TEST_RUNNER_SHOT_DIR) and attaches them. Run on a fresh install, like the
/// other tests (see README.md).
final class AccessibilityAuditTests: XCTestCase {
    let app = XCUIApplication()
    var report: [String] = []

    override func setUp() {
        continueAfterFailure = true
        XCUIDevice.shared.orientation = .portrait
    }

    override func tearDown() {
        XCUIDevice.shared.orientation = .portrait
    }

    private func write(_ name: String) {
        let text = report.joined(separator: "\n")
        let a = XCTAttachment(string: text); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? text.write(toFile: dir + "/\(name).txt", atomically: true, encoding: .utf8)
        }
    }

    private func shot(_ name: String) {
        let s = XCUIScreen.main.screenshot()
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
        let a = XCTAttachment(screenshot: s); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    private func tab(_ label: String) -> XCUIElement {
        // Home tiles/shortcuts can carry the same label as a tab (e.g. "Learn",
        // "Settings"). The tab bar is the lowest such button, so pick that one.
        let q = app.buttons.matching(NSPredicate(format: "label == %@", label))
        _ = q.firstMatch.waitForExistence(timeout: 8)
        let all = q.allElementsBoundByIndex.filter { $0.exists }
        // A tile scrolled under the tab bar is not hittable; the tab bar button is.
        let hittable = all.filter { $0.isHittable }
        return (hittable.isEmpty ? all : hittable).max(by: { $0.frame.minY < $1.frame.minY }) ?? q.firstMatch
    }

    private func start() {
        app.launch()
        let go = app.buttons["Get started"]
        if go.waitForExistence(timeout: 12) { go.tap() }
        XCTAssertTrue(tab("Home").waitForExistence(timeout: 10))
    }

    /// Lists every interactive element: label, frame, and whether it meets 44x44.
    private func auditScreen(_ name: String) {
        app.swipeDown(); app.swipeDown(); sleep(1)
        report.append("## \(name)  (window \(Int(app.windows.firstMatch.frame.width))x\(Int(app.windows.firstMatch.frame.height)))")
        var order = 0
        let kinds: [(String, XCUIElementQuery)] = [("button", app.buttons), ("radio", app.radioButtons), ("switch", app.switches), ("textField", app.textFields)]
        for (kind, q) in kinds {
            for el in q.allElementsBoundByIndex where el.exists {
                let f = el.frame
                if f.height <= 0 || f.minY < 0 || f.minY > app.windows.firstMatch.frame.height { continue }
                order += 1
                let label = el.label.isEmpty ? "<NO LABEL>" : el.label
                let small = (f.width < 44 || f.height < 44) ? "  SMALL<44" : ""
                report.append(String(format: "  [%d] %@ '%@' x=%.0f y=%.0f w=%.0f h=%.0f%@", order, kind, String(label.prefix(60)), f.minX, f.minY, f.width, f.height, small))
            }
        }
        // Reading order as exposed to VoiceOver: elements sorted by their tree order.
        let texts = app.staticTexts.allElementsBoundByIndex.filter { $0.exists && $0.frame.minY >= 0 && $0.frame.height > 0 }
        report.append("  -- static text in tree order (first 14):")
        for t in texts.prefix(14) {
            report.append(String(format: "     y=%.0f x=%.0f '%@'", t.frame.minY, t.frame.minX, String(t.label.prefix(50))))
        }
        // Images that expose a label vs. unlabeled images that VoiceOver would announce as "image".
        for img in app.images.allElementsBoundByIndex where img.exists && img.frame.height > 0 && img.frame.minY >= 0 {
            report.append(String(format: "  image '%@' h=%.0f%@", String(img.label.prefix(40)), img.frame.height, img.label.isEmpty ? "  UNLABELED" : ""))
        }
    }

    func testAuditPortraitEnglish() {
        start()
        for t in ["Home", "Qur'an", "Learn", "Progress", "Settings"] {
            tab(t).tap(); sleep(2)
            auditScreen("EN portrait \(t)")
        }
        write("findings-en-portrait")
    }

    func testAuditLandscape() {
        start()
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(2)
        let w = app.windows.firstMatch.frame
        report.append("landscape window \(Int(w.width))x\(Int(w.height))")
        for t in ["Home", "Qur'an", "Learn", "Progress", "Settings"] {
            tab(t).tap(); sleep(2)
            auditScreen("EN landscape \(t)")
            shot("land-\(t.replacingOccurrences(of: "'", with: ""))")
        }
        write("findings-en-landscape")
    }

    // MARK: enforced checks

    /// Switches follow the system UISwitch size (51x31) and segmented radios are
    /// 34pt (>= WCAG 2.5.8's 24pt); everything else must be at least 44x44.
    private func assertTouchTargets(_ screen: String) {
        app.swipeDown(); app.swipeDown(); sleep(1)
        let h = app.windows.firstMatch.frame.height
        for el in app.buttons.allElementsBoundByIndex where el.exists {
            let f = el.frame
            if f.height <= 0 || f.minY < 0 || f.minY > h { continue }
            XCTAssertGreaterThanOrEqual(f.width, 44, "\(screen): '\(el.label.prefix(40))' is only \(Int(f.width))pt wide")
            XCTAssertGreaterThanOrEqual(f.height, 44, "\(screen): '\(el.label.prefix(40))' is only \(Int(f.height))pt high")
        }
        for r in app.radioButtons.allElementsBoundByIndex where r.exists && r.frame.height > 0 && r.frame.minY >= 0 {
            XCTAssertGreaterThanOrEqual(r.frame.height, 30, "\(screen): segmented option '\(r.label)' too short")
        }
    }

    /// Every control has an accessible name (a text field's placeholder counts).
    private func assertNamed(_ screen: String) {
        let h = app.windows.firstMatch.frame.height
        for q in [app.buttons, app.radioButtons, app.switches] {
            for el in q.allElementsBoundByIndex where el.exists && el.frame.height > 0 && el.frame.minY >= 0 && el.frame.minY < h {
                XCTAssertFalse(el.label.trimmingCharacters(in: .whitespaces).isEmpty, "\(screen): unnamed control at y=\(Int(el.frame.minY))")
            }
        }
        for t in app.textFields.allElementsBoundByIndex where t.exists && t.frame.height > 0 {
            XCTAssertFalse((t.label + (t.placeholderValue ?? "")).trimmingCharacters(in: .whitespaces).isEmpty, "\(screen): unnamed text field")
        }
    }

    func testTouchTargetsAndNamesPortrait() {
        start()
        for t in ["Home", "Qur'an", "Learn", "Progress", "Settings"] {
            tab(t).tap(); sleep(2)
            assertTouchTargets("portrait \(t)")
            assertNamed("portrait \(t)")
        }
        tab("Qur'an").tap(); sleep(1)
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Al-Fatiha")).firstMatch.tap(); sleep(2)
        assertTouchTargets("portrait Reader")
        assertNamed("portrait Reader")
    }

    /// Landscape on a Dynamic Island iPhone: nothing within the camera/curve inset
    /// on either side, and everything still inside the window.
    func testLandscapeKeepsContentInsideSafeArea() throws {
        start()
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(2)
        let w = app.windows.firstMatch.frame
        XCTAssertGreaterThan(w.width, w.height, "device did not rotate")
        // Only notched / Dynamic Island iPhones have landscape side insets.
        if max(w.width, w.height) < 800 { throw XCTSkip("no landscape safe-area inset on this device") }
        for orientation in [UIDeviceOrientation.landscapeLeft, .landscapeRight] {
            XCUIDevice.shared.orientation = orientation; sleep(2)
            for t in ["Home", "Qur'an", "Learn", "Progress", "Settings"] {
                tab(t).tap(); sleep(2)
                app.swipeDown(); sleep(1)
                for q in [app.staticTexts, app.buttons] {
                    for el in q.allElementsBoundByIndex where el.exists && el.frame.height > 0 && el.frame.minY >= 0 && el.frame.minY < w.height {
                        let f = el.frame
                        XCTAssertGreaterThanOrEqual(f.minX, 47, "landscape \(orientation.rawValue) \(t): '\(el.label.prefix(30))' starts at x=\(Int(f.minX)), inside the inset")
                        XCTAssertLessThanOrEqual(f.maxX, w.width - 47, "landscape \(orientation.rawValue) \(t): '\(el.label.prefix(30))' ends at x=\(Int(f.maxX)), inside the inset")
                    }
                }
            }
        }
    }

    /// Records heights of reference text so a run at the default and at the largest
    /// accessibility text size can be compared (see README).
    func testRecordTextHeights() {
        start()
        tab("Qur'an").tap(); sleep(2)
        let row = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Al-Fatiha")).firstMatch
        row.tap(); sleep(2)
        shot("dt-reader")
        let ayahText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Reading progress")).firstMatch
        report.append("size=\(ProcessInfo.processInfo.environment["DT_LABEL"] ?? "default")")
        report.append("readingProgressLabelHeight=\(ayahText.exists ? Int(ayahText.frame.height) : -1)")
        let tabHome = tab("Home")
        report.append("tabHomeHeight=\(tabHome.exists ? Int(tabHome.frame.height) : -1)")
        write("findings-dynamic-type-\(ProcessInfo.processInfo.environment["DT_LABEL"] ?? "default")")
    }

    /// Dumps the accessibility tree (what VoiceOver walks) for manual review.
    func testDumpAccessibilityTrees() {
        start()
        sleep(2); report.append("=== Home\n" + app.debugDescription); write("tree-home")
        report = []
        tab("Qur'an").tap(); sleep(2)
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Al-Fatiha")).firstMatch.tap(); sleep(2)
        report.append("=== Reader\n" + app.debugDescription); write("tree-reader")
    }

    /// VoiceOver should read "Ayah 1 of 7" as ONE element, not four fragments.
    func testReaderProgressIsOneAccessibilityElement() {
        start()
        tab("Qur'an").tap(); sleep(2)
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Al-Fatiha")).firstMatch.tap(); sleep(2)
        XCTAssertTrue(app.staticTexts["Ayah 1 of 7"].waitForExistence(timeout: 5), "'Ayah 1 of 7' is split into fragments")
    }

    /// Captures screens for the design-fidelity comparison (screenshots only).
    func testCaptureComparisonScreens() {
        start()
        func openFromHome(_ needle: String, _ name: String) {
            tab("Home").tap(); sleep(1)
            let b = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", needle)).firstMatch
            XCTAssertTrue(b.waitForExistence(timeout: 8), "\(needle) tile missing")
            b.tap(); sleep(2)
            shot(name)
        }
        openFromHome("Understand This Ayah", "cmp-understand")
        openFromHome("Reflect", "cmp-reflect")
        openFromHome("Memorize", "cmp-memorize")
        tab("Home").tap(); sleep(1)
        app.swipeUp(); sleep(1)
        shot("cmp-home-scrolled")
    }

    /// QR-DESIGN-007A: Settings -> About & Sources credits the three text sources
    /// with the database's own review statuses, and Home shows six real tiles.
    func testHomeSixTilesAndAboutSources() {
        start()
        for name in ["Qur'an", "Understand This Ayah", "Learn", "Reflect", "Memorize", "Bookmarks"] {
            let b = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
            XCTAssertTrue(b.waitForExistence(timeout: 5), "Home tile '\(name)' missing")
            if b.exists { XCTAssertGreaterThanOrEqual(b.frame.height, 44, "tile '\(name)' under 44pt") }
        }
        shot("007a-home")
        tab("Settings").tap(); sleep(1)
        app.swipeUp(); sleep(1)
        let about = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "About & Sources")).firstMatch
        XCTAssertTrue(about.waitForExistence(timeout: 6), "About & Sources row missing")
        shot("007a-settings-bottom")
        about.tap(); sleep(1)
        for needle in ["Tanzil Project", "Marmaduke Pickthall", "Kazimirski", "Verified", "Candidate"] {
            let t = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", needle)).firstMatch
            XCTAssertTrue(t.waitForExistence(timeout: 4), "About is missing '\(needle)'")
        }
        shot("007a-about-top")
        app.swipeUp(); sleep(1)
        let notice = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Copyright")).firstMatch
        XCTAssertTrue(notice.exists, "Tanzil copyright notice not shown")
        shot("007a-about-bottom")
        XCTAssertTrue(app.buttons["Back"].exists, "About has no labelled Back control")
    }

    /// QR-DESIGN-007B: the Settings category list, a sub-page, back navigation,
    /// and the Tanzil link opening in Safari without disturbing the app.
    func testSettingsPagesAndTanzilLink() {
        // At large Dynamic Type sizes rows can sit below the fold: scroll until tappable.
        func reveal(_ el: XCUIElement) { for _ in 0..<6 where !el.isHittable { app.swipeUp(); sleep(1) } }
        func row(_ name: String) -> XCUIElement {
            app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
        }
        start()
        tab("Settings").tap(); sleep(1)
        for name in ["General", "Quran & Reading", "Language", "Appearance", "Offline access", "Privacy & Data", "About & Sources"] {
            let row = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", name)).firstMatch
            XCTAssertTrue(row.waitForExistence(timeout: 6), "Settings row '\(name)' missing")
            if row.exists { XCTAssertGreaterThanOrEqual(row.frame.height, 44, "Settings row '\(name)' under 44pt") }
        }
        for forbidden in ["Notifications", "Family", "Audio"] {
            XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", forbidden)).firstMatch.exists,
                           "Settings must not show a '\(forbidden)' row")
        }
        shot("007b-settings-list")
        // Sub-page and back.
        reveal(row("Appearance")); row("Appearance").tap(); sleep(1)
        XCTAssertTrue(app.switches.firstMatch.waitForExistence(timeout: 5), "Appearance page has no reduce-motion switch")
        shot("007b-settings-appearance")
        app.buttons["Back"].tap(); sleep(1)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Privacy & Data")).firstMatch.waitForExistence(timeout: 5),
                      "Back from Appearance did not return to the Settings list")
        // About -> Tanzil link.
        reveal(row("Language")); row("Language").tap(); sleep(1)
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Français")).firstMatch.waitForExistence(timeout: 5),
                      "Language page does not list the languages")
        shot("007b-settings-language")
        app.buttons["Back"].tap(); sleep(1)
        reveal(row("About & Sources")); row("About & Sources").tap(); sleep(1)
        let link = app.links.matching(NSPredicate(format: "label CONTAINS[c] %@", "Tanzil Project website")).firstMatch
        XCTAssertTrue(link.waitForExistence(timeout: 5), "Tanzil link missing or not exposed as a link")
        for _ in 0..<6 where !link.isHittable { app.swipeUp(); sleep(1) }
        XCTAssertTrue(link.isHittable, "Tanzil link is not reachable by scrolling")
        // Note: WebKit reports a link's accessibility frame from its text line, so
        // the 44pt CSS box (asserted in the Playwright layout test) cannot be read
        // from here; this checks reachability instead.
        shot("007b-about-link")
        link.tap()
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 20), "Tanzil link did not open Safari")
        sleep(2)
        shot("007b-safari")
        // Return: the app is where we left it.
        app.activate()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Tanzil Project")).firstMatch.waitForExistence(timeout: 8),
                      "About screen not preserved after returning from Safari")
        XCTAssertTrue(tab("Settings").exists, "tab bar missing after returning")
        safari.terminate()
    }
}
