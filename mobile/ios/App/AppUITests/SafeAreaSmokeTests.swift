import XCTest

/// QR-DESIGN-004B/004C: minimal iOS smoke, safe-area, localisation and RTL
/// checks. No third-party dependencies. Screenshots are written to $SHOT_DIR
/// when set (pass TEST_RUNNER_SHOT_DIR to xcodebuild) and always attached.
///
/// The app's language is an in-app setting (not the iOS locale), so tests
/// switch it through Settings -> Language (EN -> FR -> AR). Each test expects a
/// FRESH install (English default): run `xcrun simctl uninstall <udid> <bundle id>`
/// before each `-only-testing:` invocation; see ios/App/AppUITests/README.md.
final class SafeAreaSmokeTests: XCTestCase {
    let app = XCUIApplication()

    enum Lang: String, CaseIterable {
        case en, fr, ar
        var home: String { ["en": "Home", "fr": "Accueil", "ar": "الرئيسية"][rawValue]! }
        var quran: String { ["en": "Qur'an", "fr": "Coran", "ar": "القرآن"][rawValue]! }
        var learn: String { ["en": "Learn", "fr": "Apprendre", "ar": "التعلّم"][rawValue]! }
        var progress: String { ["en": "Progress", "fr": "Progrès", "ar": "التقدّم"][rawValue]! }
        var settings: String { ["en": "Settings", "fr": "Réglages", "ar": "الإعدادات"][rawValue]! }
        var optionName: String { ["en": "English", "fr": "Français", "ar": "العربية"][rawValue]! }
        var appearanceRow: String { ["en": "Appearance", "fr": "Apparence", "ar": "المظهر"][rawValue]! }
        var languageRow: String { ["en": "Language", "fr": "Langue", "ar": "اللغة"][rawValue]! }
        var onboardingStart: String { ["en": "Get started", "fr": "Commencer", "ar": "ابدأ"][rawValue]! }
    }

    override func setUp() {
        continueAfterFailure = true
        app.launch()
    }

    // MARK: helpers

    private var windowFrame: CGRect { app.windows.firstMatch.frame }
    /// Dynamic Island / notch devices are taller than 800pt; the SE is 667pt.
    private var minContentY: CGFloat { windowFrame.height >= 800 ? 54 : 20 }

    private func shot(_ name: String) {
        let s = XCUIScreen.main.screenshot()
        let a = XCTAttachment(screenshot: s)
        a.name = name; a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    private func button(containing label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", label)).firstMatch
    }

    /// Tab-bar buttons have exactly the tab name as label. Exact matching matters:
    /// e.g. the Arabic "Reset preferences" row contains the word for "Settings".
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

    /// Visible text/buttons must sit below the status bar and inside the screen.
    private func assertLayout(_ screen: String) {
        // The app has one scroll container, so a previous tab's scroll offset can
        // carry over. Scroll back to the top so we test the resting layout.
        app.swipeDown(); app.swipeDown(); sleep(1)
        let w = windowFrame.width
        for q in [app.staticTexts, app.buttons] {
            for el in q.allElementsBoundByIndex where el.exists && el.frame.height > 0 {
                let f = el.frame
                // Content scrolled partly behind a sticky header is not an overlap defect.
                if f.minY < 0 { continue }
                XCTAssertGreaterThanOrEqual(f.minY, minContentY,
                    "\(screen): '\(el.label)' at y=\(f.minY) overlaps the status bar / Dynamic Island")
                XCTAssertGreaterThanOrEqual(f.minX, -1, "\(screen): '\(el.label)' leaks off the left edge")
                XCTAssertLessThanOrEqual(f.maxX, w + 1, "\(screen): '\(el.label)' leaks off the right edge")
            }
        }
    }

    private func openTab(_ lang: Lang, _ which: KeyPath<Lang, String>) {
        let b = tab(lang[keyPath: which])
        XCTAssertTrue(b.waitForExistence(timeout: 8), "tab '\(lang[keyPath: which])' missing")
        b.tap()
        sleep(2)
    }

    /// Dismiss onboarding if this is a fresh install (any language).
    private func passOnboarding(shotPrefix: String) {
        for l in Lang.allCases {
            let start = app.buttons[l.onboardingStart]
            if start.waitForExistence(timeout: l == .en ? 12 : 1) {
                assertLayout("Onboarding")
                shot("\(shotPrefix)-onboarding")
                start.tap()
                sleep(1)
                return
            }
        }
    }

    /// Settings -> Language, then choose `target` on the Language page.
    private func setLanguage(_ target: Lang) {
        passOnboarding(shotPrefix: "pre")
        for _ in 0..<3 {
            if tab(target.settings).waitForExistence(timeout: 3) &&
               !isOtherLanguageActive(besides: target) { break }
            // open Settings in whichever language is active
            for l in Lang.allCases {
                let b = tab(l.settings)
                if b.exists { b.tap(); break }
            }
            sleep(1)
            for l in Lang.allCases {
                let row = button(containing: l.languageRow)
                if row.exists { row.tap(); break }
            }
            sleep(1)
            // Language page: pick the target language directly (QR-DESIGN-007B).
            let option = app.descendants(matching: .any)
                .matching(NSPredicate(format: "label CONTAINS[c] %@", target.optionName)).firstMatch
            if option.waitForExistence(timeout: 5) { option.tap() }
            sleep(1)
        }
        XCTAssertTrue(tab(target.settings).waitForExistence(timeout: 5),
                      "could not switch UI language to \(target.rawValue)")
    }

    private func isOtherLanguageActive(besides t: Lang) -> Bool {
        Lang.allCases.filter { $0 != t }.contains { tab($0.progress).exists }
    }

    private func walk(_ lang: Lang, prefix: String) {
        let tabs: [(String, KeyPath<Lang, String>)] =
            [("Home", \.home), ("Quran", \.quran), ("Learn", \.learn), ("Progress", \.progress), ("Settings", \.settings)]
        for (i, t) in tabs.enumerated() {
            openTab(lang, t.1)
            assertLayout("\(prefix) \(t.0)")
            shot(String(format: "%@-%02d-%@", prefix, i + 1, t.0))
        }
    }

    // MARK: tests

    func testEnglishOnboardingTabsAndReader() {
        setLanguage(.en)
        walk(.en, prefix: "en")
        openTab(.en, \.quran)
        let row = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] %@", "Al-Fatiha")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 8))
        row.tap(); sleep(2)
        assertLayout("en Reader")
        shot("en-06-reader")
    }

    func testFrench() {
        setLanguage(.fr)
        XCTAssertTrue(tab("Réglages").exists)
        walk(.fr, prefix: "fr")
        // Settings in French must show French copy.
        openTab(.fr, \.settings)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", Lang.fr.appearanceRow)).firstMatch.waitForExistence(timeout: 5))
    }

    func testArabicRTL() {
        setLanguage(.ar)
        // Tab order is mirrored: Home sits to the RIGHT of Settings.
        let home = tab(Lang.ar.home), settings = tab(Lang.ar.settings)
        XCTAssertTrue(home.waitForExistence(timeout: 5) && settings.exists)
        XCTAssertGreaterThan(home.frame.minX, settings.frame.minX, "Arabic tab bar is not mirrored (RTL)")
        walk(.ar, prefix: "ar")
        openTab(.ar, \.settings)
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", Lang.ar.appearanceRow)).firstMatch.waitForExistence(timeout: 5))
    }
}
