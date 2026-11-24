# QR-RELEASE-002A: Security hardening and integration preparation

Written for the project owner. Only the QR-RELEASE-001 assessment branch was pushed (draft PR #94). Everything else below is **local**: nothing was merged, retargeted, deployed or signed; no ruleset, billing, production database, Quran text, translation, fingerprint, source status or artwork was changed. Production Deployment run 44967138877 and the waiting run remain unapproved.

## 1. Assessment report draft PR

[#94](https://github.com/vertexone-dev/quran-fluent/pull/94), `docs/qr-release-001-review-and-integration` at `927d390`, base `docs/qr-design-007e-verification-materials` (#93). Verified before pushing: ancestry from #93, clean tree, no secrets in the diff, no remote branch of that name existed. Not force-pushed.

## 2. Repository baseline

`origin/main` = `9f24767`. Open draft PRs: #68, #76 to #94 (20). Heads of #90 (`5ad2a0f`), #91 (`77f45f9`), #92, #93 unchanged. The temporary branch `ci/qr-design-007e-content-full-run` was deleted in QR-RELEASE-001 and its run (45172445848) is preserved.

Local branches created (all unpushed): `integration/qr-mobile-consolidated` (`c452202`), `integration/qr-web-consolidated` (`f7422bb`), `security/qr-release-002a-mobile-hardening`.

## 3. Proposed consolidated integration branches

Both were built from `origin/main` with **merge commits only**; no published branch was touched.

| Branch                               | Built from                                                                                                                                          | Result                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `integration/qr-mobile-consolidated` | tip of #94 (the app and docs chain: #76, #78, #79, #80, #83, #84, #87, #88, #89, #91, #93, #94), then tip of #92 (the CI chain: #81, #85, #90, #92) | **both merges clean**; 156 files, +12,082 / -627, 29 non-merge commits |
| `integration/qr-web-consolidated`    | tip of #86 (#77, #82, #86)                                                                                                                          | clean; 12 files, +777 / -14, 4 non-merge commits                       |

Cross-chain dependencies: the two mobile chains share #76 to #80 and both edit `mobile/` (the CI chain also edits the mobile workflow and scripts); they merge without a conflict. Mobile and web chains share **no file** and a trial merge of the two gives no conflict hunks. The #92 and #93 symlink fixes are included, and the old guard in #85, #90 and #91 is replaced by the fixed one.

Regression tests on the consolidated mobile branch: full database rebuild in Docker with **both pinned fingerprints matching** (`b586ba39…` and `b04a3c5a…ab780`). Unit, Playwright, Android and iOS results are in section 5; they were run on the security branch, which contains the consolidated mobile branch plus the hardening.

### Sequential versus consolidated

|                              | Sequential (19 PRs, current stacks)                                                                                                                                                                                              | Consolidated (2 PRs: mobile, web)                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI time                      | the ruleset requires an up-to-date branch, so each PR re-runs `test` (about 47 to 51 minutes) after the previous merge: the mobile critical path is 16 merges, about **13 hours** of serial `test` runs, plus the web chain of 3 | one `test` per PR; if both go in, the second needs one re-run: about **100 minutes**                                                                          |
| Production deployment        | every merge to `main` queues a Production Deployment run needing approval: about 19                                                                                                                                              | 2                                                                                                                                                             |
| Reviewability                | small, themed diffs; each already reviewed on its own page                                                                                                                                                                       | one 156-file, 12,000-line mobile PR. Mitigation: the merge commits keep every original commit, and the existing draft PRs stay as the per-topic reading guide |
| Risk                         | main passes through 19 intermediate states that were never tested together; stacked PRs have had no CI                                                                                                                           | one large change; a defect anywhere blocks everything; bisecting needs the preserved history                                                                  |
| Rollback                     | revert in reverse order (up to 16 reverts), but partial rollback is possible                                                                                                                                                     | `git revert -m 1` on one merge commit per chain; tag `main` before merging as a restore point                                                                 |
| Review fatigue and approvals | the ruleset needs 1 non-author approval per PR (19 approvals)                                                                                                                                                                    | 2 approvals                                                                                                                                                   |

Recommendation: **consolidated**, one PR per chain, merge commit method, with each chain's PRs closed as "included in" the consolidated PR afterwards (not before). Neither option was executed.

## 4. PR #68 disposition recommendation

Kept open and unmodified. Findings from comparing it with the consolidated mobile branch:

- #68 has two commits: the Design Lock v1.0 mobile integration (`f315bf8`) and the fail-closed artwork guard (`772e30a`). `git cherry` shows **both are already present as equivalent patches** in the #76 chain (`106f91b` and `78231d6`).
- 84 files changed: 59 identical to the consolidated branch, 19 exist but were **superseded** by later work (Home, tabs, Reader, Settings, i18n, styles, the artwork guard, smoke tests), 5 deletions of old font files (Open Sans, Playfair Display; the consolidated branch has none of them, and uses Nunito Sans and Cormorant Garamond), and **1 file unique to #68**: `PlannedScreen.tsx`, a "coming soon" placeholder for Reflect and Memorize that the #76 chain replaced with real Reflect and Memorize screens.
- Merging #68 first would conflict with the whole chain (32 hunks against #76, 43 against the stack head); merging it after the chain would re-introduce the placeholder screen and delete the current fonts' siblings.
- Closing it loses no functionality and no commit (the commits stay in the branch).

**Recommendation: close #68 as superseded**, after the consolidated mobile PR is merged (or now, if you prefer, with a comment pointing to #76). No selective integration is needed.

## 5. Security fixes and test results

Details: `mobile/docs/SECURITY-HARDENING-002A.md`.

**Changes (local security branch):**

1. **Content-Security-Policy** (`mobile/csp.ts`, injected into the built page): `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`. No wildcard, no `unsafe-eval`, no `unsafe-inline`.
2. **Android backup policy** (section 7): nothing goes to the cloud; device transfer is kept.
3. **Android `INTERNET` permission removed**: the app is offline and the Tanzil link is an intent. The merged manifest declares no permission.
4. **Dynamic Type probe**: it assigned `style.cssText`; it now sets single CSSOM properties, which is safe under a strict policy (unit test added). Defensive: I did **not** demonstrate that WebKit blocks `cssText` here (see section 6).
5. **French Home overflow on iPhone SE** (a real, pre-existing defect, found by the smoke test): with a saved reading position the "Votre parcours" card was 396 pt wide on a 375 pt screen. Fixed with a few lines of CSS (`.journey-card` capped at the container width, header wraps). Verified on the simulator: 3/3 pass after, failing before, **with and without the CSP**.

**Test results** (the legend: pass / fail / skipped / not available):

| Check                                                                                      | Result                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (`tsc --noEmit`, mobile)                                                        | pass                                                                                                                                                                                                                                                                       |
| Mobile unit tests with the rebuilt database, `REQUIRE_CONTENT_DB=1`                        | pass: 16 files, 163 tests, none skipped                                                                                                                                                                                                                                    |
| Mobile Playwright, dev server                                                              | pass: 225/225                                                                                                                                                                                                                                                              |
| Mobile Playwright against the **built** app with the CSP                                   | 224/225; the one failure is the dev-only artwork test (release builds carry no artwork by design)                                                                                                                                                                          |
| CSP spec (4 tests)                                                                         | pass; mutation-checked (removing `'wasm-unsafe-eval'` fails it; the control proves inline script and a remote image are blocked)                                                                                                                                           |
| Full database rebuild (Docker) and both fingerprints                                       | pass on the consolidated mobile branch; not re-run on the security branch (it changes no content)                                                                                                                                                                          |
| CI gate scripts and symlink tests (12)                                                     | pass                                                                                                                                                                                                                                                                       |
| Symlink regression and fail-closed tests (existing, 007E)                                  | pass (part of the 163)                                                                                                                                                                                                                                                     |
| Release artwork guard                                                                      | pass (`npm run build` and `release-art-guard`)                                                                                                                                                                                                                             |
| `actionlint` on the changed workflow                                                       | pass                                                                                                                                                                                                                                                                       |
| Prettier on changed and new files                                                          | pass                                                                                                                                                                                                                                                                       |
| ESLint, whole repo                                                                         | pass: 0 errors, 18 warnings (the same 18 as before). A first run reported 14 errors; the build folders `dist-csp` and `dist-e2e` from my own test runs were present then (not in git, since removed), and I did not keep that output, so the cause is inferred, not proven |
| Android emulator smoke (isolated emulator, API 35, final backup rules, CSP, no permission) | 52/52 in each of 3 runs, then 52/52 after the permission removal; **one earlier run gave 46/52 and I did not keep its failure list** (not reproduced in 4 further runs)                                                                                                    |
| Android lint                                                                               | 0 errors (20 warnings; none about backup)                                                                                                                                                                                                                                  |
| Android actual backup contents                                                             | **not available**: the emulator's local transport rejected the package under both old and new rules                                                                                                                                                                        |
| iOS simulator smoke, iPhone SE (3 tests: English, French, Arabic)                          | pass 3/3 on the final build (CSP, no permission change affects iOS, CSS fix). Earlier, the French test **failed** (see section 6)                                                                                                                                          |
| iOS accessibility tests (AX3/AX5), iPhone 17 Pro                                           | **not run** this phase                                                                                                                                                                                                                                                     |
| Real devices, TalkBack, VoiceOver                                                          | **not available**                                                                                                                                                                                                                                                          |
| Workflow run on GitHub                                                                     | **not run** (needs a push, not authorised)                                                                                                                                                                                                                                 |

## 6. CSP compatibility findings

- Chromium: no violation on any screen, tab, the reader or settings; no request leaves the app's own origin.
- Android WebView: the smoke suite passes on the built APK; no policy violation appeared in logcat.
- **iOS (WebKit), what happened, with a correction.** The first iPhone SE run failed `testFrench` (card 396 pt wide, limit 376). I first concluded the CSP had broken the Dynamic Type probe, because the test passed **alone** on a build without the CSP and also alone after I replaced `style.cssText`. That conclusion was **wrong**: run alone, the test starts from a fresh install with no saved reading position, so the card that overflows never appears. The full three-test run on a build with **no CSP at all** fails the same way, so the cause was an older layout defect (order-dependent: the English test saves a position first), not the CSP. It was fixed in CSS and verified (item 5 above). The `cssText` change is kept as a precaution only.
- Chromium cannot reproduce that overflow (the card fits at 375 and 320 px), so no browser test guards it; the iPhone SE smoke test is the only check.
- `wasm-unsafe-eval` is needed for sql.js. A policy without it was tested and breaks the app.
- A meta-tag policy cannot set `frame-ancestors` or report violations; neither matters for a bundled WebView.
- The dev server does not carry the policy (hot reload needs inline scripts); release and Capacitor builds do.

## 7. Android backup policy

Details: `mobile/docs/ANDROID-BACKUP-POLICY.md`. The app's user data is one localStorage store holding bookmarks, reading position, preferences and the user's **private reflections**. Before: all of it, reflections included, went to the cloud backup. After: **cloud backup uploads nothing; device-to-device transfer keeps everything** (Android 12+); Android 11 and lower back up nothing. Trade-off: a factory-reset phone no longer gets bookmarks from the cloud. Alternative for the owner: store reflections separately and back up the rest. The actual backup contents could not be inspected on the emulator.

## 8. Mobile identity and signing plan

Details: `mobile/docs/APP-IDENTITY-AND-SIGNING.md`. Android and Capacitor already use `com.quranroots.app`; iOS uses `com.quranroots.mobilefeasibility`. `com.quranroots.app` is suitable for both stores; no public listing uses it (inconclusive by nature), and the domain `quranroots.com` exists (ownership not verified by me). The identifier becomes permanent at the first store submission, so confirm before then. Open: Apple Developer membership, team ID, App Store Connect record, distribution certificate and profile; Google Play Console account, upload keystore, Play App Signing, AAB build, store forms. **Nothing was changed or created.**

## 9. Proposed mandatory CI protection

Details: `mobile/docs/MANDATORY-CI-PROTECTION.md`, `mobile/docs/proposed-ruleset-protect-main.json`. A `changes` job classifies the PR; the job `mobile release gate` always runs and passes only when nothing mobile changed or all three mobile jobs succeeded (a skipped job fails; a failed classification fails). The pull-request trigger now covers every base branch, so stacked and consolidated PRs are checked. The ruleset proposal is the live ruleset plus `mobile release gate` beside `test`. The workflow keeps the name `QuranRoots Mobile CI`, so it cannot start a production deployment. Tested locally (12 unit tests, the classifier on real PR diffs, actionlint); **not run on GitHub**. Residual risk: a PR can edit the workflow it runs under; add CODEOWNERS and code-owner review for `.github/workflows/**` and `mobile/scripts/ci/**`.

## 10. Independent review blockers

1. No named Arabic, French or legal reviewer, and no second approver. Reviewer packages are ready (`REVIEWER-PACKAGES.md`).
2. Legal: Tanzil "no changes" term and the missing copyright block in the public migration; the 58 bootstrap ayahs credited to Tanzil; Wikisource licence; Pickthall's US-only record; artwork rights.
3. **Website dependencies:** `npm audit --omit=dev` on the root package shows **5 critical and 6 high** advisories (TanStack Start reflected XSS in server-function responses, fix available in `@tanstack/react-start` 1.169.7; also `vite`, `zod`, `seroval`, `js-yaml`, `fast-uri`, `source-map-js`). Not touched; it needs its own tested update. **Most urgent security item.**
4. No real-device, TalkBack or VoiceOver testing; no iPad.
5. Gate not yet required by the ruleset; no CODEOWNERS.
6. Bundle identifier and signing undecided; accounts and fees not authorised.
7. Native French and Arabic review of the interface text.
8. Unresolved decisions: backup trade-off, #68, merge strategy.

## 11. Remaining Design Lock implementation tasks (no redesign started)

Mobile (from the 007B and 001 comparisons): Home "Your Journey" progress card with sample data is real-data driven; a Family Mode tile has no feature; the Reader's ornate gold frame, ayah medallion, audio controls and Word-by-Word tab; Understand This Ayah's Key Lessons panel; Reflect and Memorize full designs and prompts; the circular progress ring and statistics on Progress; launch screen artwork; profile in place of Settings. Website: notification bell; glow and button effects; exact card styling. All painted artwork stays blocked until written rights exist; CSS-only treatments ship instead.

## 12. Required owner approvals

1. Push the consolidated branches and the security branch as draft PRs (and the CI protection change inside it).
2. Merge strategy: consolidated (recommended) or sequential.
3. Close #68 as superseded (when).
4. The Android backup trade-off (cloud off, transfer on), and whether to split reflections into a separately excluded store.
5. Removal of the `INTERNET` permission and the CSP (a product and release decision).
6. Add `mobile release gate` as a required check; add CODEOWNERS; decide about the Admin bypass.
7. Website dependency update (the critical advisories), as its own change.
8. Bundle identifier, Apple team, Google Play account, signing, fees.
9. Named reviewers and a second approver; artwork rights.
10. Production deployment runs: leave unapproved.
