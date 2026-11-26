# QR-DESIGN-008B: visual fidelity, educational features and security validation

Final candidate: branch `feat/qr-design-008b`, local only (not pushed). It merges the 008A visual work with the website CSP
branch. Feature code is at `21456e8` and `f05169e`; the last commit is documentation. The only push in this phase was the
authorized one, `feat/qr-web-csp` (draft PR #103). Production Deployment run `44967138877` is still pending and unapproved.
No merge, deployment, billing change, ruleset change, content change, source-status change or spend.

## 1. Part 9 of 008A (scholarly integrity): results

Recorded in `QR-DESIGN-008A-REPORT.md` section 11 and verified on this candidate:

- Approved database file SHA-256 `43441fa8b2c3f225…` unchanged before and after every use (copies only; no sidecars).
- Both pinned fingerprints verified on a fresh disposable rebuild: content `b586ba39…1225b1` (114 surahs, 6,236 ayahs) and
  full content (20 tables, 27,247 rows).
- Source statuses unchanged: Tanzil `candidate`, Kazimirski (active segments) `candidate`, Pickthall `verified` with its recorded
  US-only public-domain limitation, Hamidullah `disputed` with **0** exported rows (still excluded; not resolved by me).
- No independent scholarly, linguistic or legal approval is claimed. 008A section 12 corrects my earlier wrong claim that Reflect
  had no prompts.

## 2. PR review (#101, #102) and the new CSP draft PR

|                 | #101 website dependencies                                                                                                             | #102 report and gate guide                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Ancestry        | descends from `integration/qr-web-consolidated` (#96)                                                                                 | descends from `security/qr-release-002a-mobile-hardening` (#97) |
| Scope           | 4 files: `package.json`, lockfile, `ensure-local-test-user.mjs`, `__root.tsx`                                                         | 2 documentation files                                           |
| Secrets         | none found in the diff                                                                                                                | none found                                                      |
| CI              | **none reported**: the `test` workflow runs only for PRs into `main`, and this PR's base is not `main`; its evidence is my local runs | gate passes (docs-only PRs skip the database jobs by design)    |
| Documented risk | `zod` 3.25.76 still listed by `npm audit` (guard test and plan in the 008A closure branch); `/_serverFn/` still mounted               | none                                                            |

I did not approve either PR on anyone's behalf. **New draft PR: https://github.com/vertexone-dev/quran-fluent/pull/103**
(`feat/qr-web-csp`, base `security/qr-security-003-web-deps`, i.e. stacked on #101). Not deployed.

## 3. CSP: rollout, fail-safe, rollback and combined results

`CSP_MODE` Worker variable: unset or any unrecognised value = **report-only** (blocks nothing); `enforce` must be explicit;
`off` removes the header (rollback with no code deploy). Tested in all three modes on a real dev server. Rollout steps, the
rollback and its limits (report-only has no collection endpoint, so violations are visible only in a browser console) are in
`docs/WEBSITE-CSP.md`.

Combined (dependencies + CSP + visual + features) in an isolated environment:

- The CSP spec (14 tests) passed in the full Chromium run and on WebKit against a built Worker.
- Enforced policy found one real incompatibility: the CSS-art specs inject a `<style>` tag, which an enforced CSP blocks.
  Those tests now run with `bypassCSP` (they test artwork; spec 77 tests the CSP).
- A fresh nonce per request, a client-sent nonce ignored, no violations on 7 routes, injected script/handler/foreign host blocked
  (all in spec 77).
- Not verified: production Cloudflare-injected scripts, the real Supabase origin, Stripe checkout, non-Chromium/WebKit browsers.
- Zod 3.25.76 retained with its documented risk and guard test; the native zod 4 migration is a separate future task
  (`docs/ZOD-ADVISORY-AND-MIGRATION.md` on branch `docs/qr-design-008a-closure`, local, not merged into this candidate).

## 4. Settings sidebar

`src/components/settings/SettingsNav.tsx`, used by the Settings layout. Entries are only real sections: Profile, Learning and
Qur'an display, Appearance, Display preferences, Account (each points at an existing card), plus the real Billing route. It is
navigation only (no control inside it). Desktop: sticky left column with a gold active state; phones: wraps above the content
(no horizontal overflow at 320 px). Keyboard: native links, focus moves to the target card, visible focus ring, 44 px targets.
Scroll-spy marks the current section. Labels reuse the cards' own translated titles; one new key (`navLabel`) in EN/FR/AR. RTL
mirrors. 12 tests (`78-settings-sidebar.spec.ts`). Existing Settings behaviour unchanged; two older assertions in spec 61
had to be scoped because "Profile" now also appears in the sidebar.

## 5. Reflect

Inspected first: reflections are rows in `public.notes` (RLS `notes_own`), and the page already had four topical prompts. **No
new table, column or migration.** Changes: the ayah view now has three separate, labelled regions: "From the Qur'an" (Arabic as
stored plus the translation, in a framed panel), a dashed gold "Reflection prompt · not part of the Qur'an" block with the
question and chips and a note that prompts are not interpretations or rulings, and "Your reflection" with a privacy statement
(private to the account, not shown to other users; it does not claim encryption). Two new prompts: "What I learned" and "How I
may apply it", in English, French and Arabic. No AI is used at runtime; free. Offline: the website has no offline mode (needs a
connection); the mobile Reflect screen, which stores locally, was not changed.

**Review status: UNREVIEWED, marked in code** (`src/locales/reflect-review.ts`, a test keeps it so until a reviewer is recorded;
ledger `docs/REFLECT-PROMPTS-REVIEW.md`). The two new prompts and the French and Arabic wording are AI-drafted and need
educational, native-speaker (FR, AR) and scholarly review before release. A coarse guard test (questions only, no ruling words,
same set in every language, no Arabic in EN/FR prompts) is not a review. Mutation-checked.

## 6. Memorization progress ring

Per-Surah ring (the most recently started Surah, like the reference) on the Memorize overview, drawn only from the learner's own
records. **Calculation** (documented in `src/lib/memorization-progress.ts` and on the page): memorized = rows with status
`memorized`; learning = status `learning`; not started = Surah ayah count minus those; percentage = memorized / Surah ayah count
(learning is not counted as memorized, "<1%" never rounds a non-zero amount to 0, and values are clamped so it cannot exceed
100%); **revision due** = that Surah's scheduled review items due today or earlier, shown as a count and not as a ring segment
because it overlaps the other states. Empty state when no records exist ("Nothing is estimated or pre-filled", empty ring, 0%).
Accessible: the ring is an image with a full text label, and the legend lists every number as text; EN/FR/AR. Uses existing
tables (one new read-only count query). Free. Website only: the mobile app has no memorization tracking, so it keeps its
honest "not available" state. 8 unit tests and 4 end-to-end tests; mutation-checked.

## 7. Design Lock fidelity

All five original hashes re-verified (match the manifest). Detailed screen-by-screen assessment:
`docs/QR-DESIGN-008B-VISUAL-GAP-ASSESSMENT.md` (copy in the private folder). Rights-cleared improvements this phase, beyond the
008A card surface and title rule: Settings sidebar, Reflect structure, Memorize ring, and the Design Lock button states (gold
focus ring, glowing hover, click halo; a test checks hover, focus and disabled). Not done, and why: artwork everywhere
(rights-blocked); the Reader's three-pane layout; the Progress ring and statistics; a transparent header emblem; journey
thumbnails. Family and notification features were not introduced. Differences are listed per screen; none is measured by a
pixel score.

## 8. Artwork and emblem

`docs/QR-DESIGN-008B-EMBLEM-PROVENANCE.md`. **`mobile/public/brand/quranroots-emblem.png`**: SHA-256 `582b5316…49c3`,
703x483 PNG with alpha, no embedded metadata, one git commit (`106f91b`, 2026-11-10, "Emergent handoff, verbatim"). Identical
bytes exist in Emergent's `QuranRoots_Final_Delivery`, whose README says it was "pixel-extracted from `04_official_logo.png`
(background removed by script)", and `04_official_logo.png` is one of the five originals the Design Lock README calls
"original generated PNG files". Used by the mobile splash and onboarding and, per that delivery, the source of the Android and
iOS launcher icons and splash screens (30 PNGs, not byte-compared). **No rights documentation exists** for it; what the repo
records is the owner's design approval, not a rights finding. **Classified as a release blocker pending your decision**; nothing
removed or replaced. Options (written rights, a commissioned vector logo, an interim without the emblem, or an explicit risk
acceptance) are in the document. The full original-artwork inventory is `docs/QR-DESIGN-008A-ASSET-INVENTORY.md`. Nothing was
generated, extracted or published; the release artwork guard passed on the web and mobile builds.

## 9. Where to look: exact paths (private, outside git, owner-only permissions)

Folder: `/Users/amkristian/Pictures/QuranRoots_Design_Review_008B/` (index with every path: `INDEX.md`; assessment: `GAP-ASSESSMENT.md`).

Comparisons, `comparisons/`: `01_website_homepage_VS_current.png`, `02_complete_website_VS_current.png`,
`03_mobile_screen_01_01-launch_VS_current.png` through `03_mobile_screen_10_10-progress_VS_current.png` (all ten),
`04_official_logo_VS_current.png`, `05_settings_web_mobile_VS_current.png`, `06_languages_website_desktop_EN_FR_AR.png`,
`07_languages_website_phone_EN_FR_AR.png`, `08_languages_mobile_EN_FR_AR.png`, `09_narrow_320_website_EN.png`,
`10_ios_iphone_se_normal_vs_largest_text.png`.
Raw screenshots: `web/` (132 screenshots: desktop, tablet, phone and 320 px; EN, FR, AR), `mobile/ios-iphone-17-pro/`,
`mobile/ios-iphone-se/`, `mobile/ios-iphone-se-largest-text/`, `mobile/android-emulator/`, and `mobile/mweb-*` (44, the mobile
app's release web build). The Memorize and Reflect captures use seeded disposable test records. Originals stay at
`~/Pictures/QuranRoots_Design_Lock_v1/01_LOCKED_ORIGINALS/` and were not copied or committed.

## 10. Regression results (final candidate)

| Check                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript (root, mobile)                                          | pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ESLint, all tracked files                                          | 0 errors, 20 warnings (all pre-existing)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Website unit                                                       | 301 pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Mobile unit (verified copy of approved DB, `REQUIRE_CONTENT_DB=1`) | 163 of 163 pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Website Playwright, Chromium, full (680 tests, commit `143613d`)   | **661 passed, 4 failed, 15 skipped** (skips = production-targeted specs). The 4 failures were my changes' side effects (below); fixed in tests only and the 21 related tests re-run on `cf33ba9`: **21 passed**. The rest of the suite was not re-run after those test-only commits                                                                                                                                                                                            |
| An earlier run of the same suite                                   | stopped at 315 passed, 10 failed, 538 not run: 4 CSS-art tests (enforced CSP blocks injected styles, fixed) and 6 WebKit-on-dev-server failures (page reloads; WebKit made opt-in and moved to a built Worker)                                                                                                                                                                                                                                                                 |
| WebKit, signed-out (150 tests, built Worker)                       | **148 passed, 2 failed**: both in `auth.spec` logout flows. Both reproduce on a build of the baseline #101 (no CSP, no visual work): the logout test fails there too and the stale-warning test failed 2 of 3 times, so they predate my work                                                                                                                                                                                                                                   |
| WebKit, signed-in subset (Settings, Reflect, Memorize)             | 34 passed                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Mobile Playwright (225) and mobile CSP spec (4)                    | all pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Full DB rebuild and both fingerprints                              | pass; approved DB hash unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Artwork guard (web, mobile)                                        | pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| E2E isolation safeguard                                            | refuses a `.env.test` that names a different stack than the disposable one (verified against the disposable stack only)                                                                                                                                                                                                                                                                                                                                                        |
| Android emulator smoke (emulator-5558)                             | **49 of 50**. The one failure, "Practice opens from Home shortcut": the shortcut's bounds sit behind the bottom tab bar until Home is scrolled, so the script's tap hits a tab. **Verified on the device:** after scrolling, a physical tap opens Practice ("Review exercises from your lessons"); screenshot `mobile/android-emulator/android-06-practice-shortcut-opened.png`. The script itself was left unchanged (my attempted fix broke 8 other steps, so I reverted it) |
| Android font scale 1.0 to 2.0                                      | 24 of 24 (after I stopped the Google app's WebView, which the script's `head -1` had wrongly picked)                                                                                                                                                                                                                                                                                                                                                                           |
| iOS iPhone 17 Pro: 3 UI tests + accessibility audit (5)            | all pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| iOS iPhone SE (3rd gen), default text                              | 3 of 3 pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| iOS iPhone SE, largest accessibility text                          | 3 of 3 pass. **A screenshot shows a defect the tests do not catch:** the French Home headline breaks mid-word ("Remonte / z à la langue."). Not fixed (mobile code out of scope); recorded as a remaining defect                                                                                                                                                                                                                                                               |

The four Chromium failures: spec 61 (two tests) assumed "Profile" was unique on the Settings page; spec 65's French/Arabic test
set the language through localStorage instead of the profile; spec 79's test left the page before its write finished. All three
were test faults; the sidebar's scroll-spy had a real bug that I fixed in the component before the full run.

## 11. Mistakes and incidents this phase

- **Lost four hours.** My background waiter used `pgrep -f "playwright test"`, which matched its own command line, so it never
  returned although the suite had finished in 26 minutes. You caught it. I now poll a PID.
- **A step I should not have attempted.** I tried to run the E2E setup script without the explicit workdir (to demonstrate the
  refusal); that would have run `supabase status` against the repository, i.e. your stack. The tool blocked it before anything
  ran, and I dropped the step. Nothing touched your stack this phase. (Last phase I did read its user count, which you have
  now told me not to do.)
- **Cleanup error.** I deleted `qr-integ-web/node_modules`, the real dependency folder the other worktrees' symlinks pointed
  to, thinking it was another symlink. It is my own worktree and `npm ci` restores it exactly from the lockfile; nothing of
  yours was affected. The other worktrees currently have no dependencies installed, so run `npm ci` before using them.
- A mobile web screenshot set first came from the dev server, which shows the blocked review artwork; I replaced it with
  release-build captures before building any comparison.

## 12. Cleanup

Removed what I created: the disposable Supabase stack, my `.env.test`, the iPhone SE simulator I made, the database and WASM
copies, the symlinks, build outputs and my emulator (5558). Your emulators 5554 and 5556, your Supabase stack and the approved
database were not touched. Kept for you: worktrees `qr-008b`, `qr-008a`, `qr-visual`, `qr-web-csp` and their local branches.

## 13. Remaining blockers and decisions

1. **Emblem rights** (release blocker for the app icon, splash and two screens) and the hero art: your decision (section 8).
2. **Reflect prompts** need educational, French/Arabic native and scholarly review before release.
3. **French/Arabic labels** added this phase (sidebar, ring, Reflect) also need native review.
4. #101 has no CI because of its base; #103 and the combined branch need CI once retargeted at `main`.
5. CSP: choose when to deploy report-only, who browses the real site, and when to enforce. The Cloudflare features check is open.
6. Mobile: the French headline mid-word break at the largest text on iPhone SE; Memorize and Practice-shortcut script fix.
7. Not tested: real devices, TalkBack, VoiceOver, desktop Safari, the full Chromium suite after the last test-only commits.
8. Not done by design: Reader three-pane layout, Progress ring, Family, notifications; the zod 4 migration.
9. Push approval for `feat/qr-design-008b` (and the zod docs branch) if you want a draft PR for the combined work.
