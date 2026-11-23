# QR-DESIGN-007C: Release readiness and accessibility

Written for the project owner. Local work only. Nothing from 007C was pushed or opened as a PR; the only publication this phase was the authorised push and draft PR for 007B.

## 1. Branch and commit details

| Item                     | Value                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 007B pushed              | `feat/qr-design-007b-settings-fidelity` at `f0873a1`, parent `3a82f86` (verified before pushing)                                                                                           |
| 007B draft PR            | [#88](https://github.com/vertexone-dev/quran-fluent/pull/88), base `feat/qr-design-007a-visual-alignment` (#87), draft. No CI runs (non-`main` base); the PR text states the local results |
| 007C branch (local only) | `feat/qr-design-007c-release-readiness`, based on `f0873a1`                                                                                                                                |
| 007C commit              | see `git log` on that branch (one local commit; not pushed)                                                                                                                                |
| `origin/main`            | `9f24767`, unchanged. PRs #68, #76 to #87 unchanged                                                                                                                                        |
| Approved Quran database  | file SHA-256 `43441fa8…`, content fingerprint `b586ba39…`, 114 surahs and 6,236 ayahs: verified with `verify-content-db.mjs` on a temporary copy; owner's repo has no stray files          |
| Locked originals         | all five match `DESIGN_LOCK_MANIFEST.json`                                                                                                                                                 |

Before pushing 007B I confirmed the remote and every PR head were unchanged, the commit and parent were as stated, and the database was unchanged.

## 2. Files changed (007C, local)

- **App:** `dynamic-type.ts` (measures the Android font scale), `styles.css`, `AboutScreen.tsx`, `LessonsScreen.tsx`, `MemorizeScreen.tsx`, `SurahListScreen.tsx`.
- **Tests:** `dynamic-type.test.ts`, `dynamic-type.spec.ts`, new `overflow-sweep.spec.ts`, the iOS `AccessibilityAuditTests.swift`.
- **Android tooling:** new `font-scale.sh` and `cdp-eval.mjs`, plus a README section.
- **Documents:** `mobile/docs/CI-DATABASE-STRATEGY.md`, `mobile/docs/SOURCE-VERIFICATION-WORKFLOW.md`, this report.

## 3. Android accessibility (isolated emulator `qr_design_verify`, port 5560; 5554 and 5556 untouched)

**Cause.** On Android the WebView zooms text by the system font scale but leaves `rem` alone. The earlier "1.3x chrome cap" only existed on iOS, so five tab labels were cut off at 2.0.

**Fix.** The page measures the zoom the WebView applies (a `16px` probe reports 20.8, 24 and 32px at 1.3, 1.5 and 2.0) and feeds it to the same chrome cap iOS uses. It is never multiplied into the root size a second time. Everything is exactly as before at 1.0 and on iOS.

**Results on the final APK:**

| Check                                                                                         | Result                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab bar at font scale 1.0, 1.3, 1.5, 2.0, in **English, French and Arabic** (`font-scale.sh`) | **24/24 in each language**: five tabs, none clipped, every tab at least 80x50 CSS px, and each tab tap navigates                                                          |
| Label size on device                                                                          | 11.5px (1.0), 15px (1.3, 1.5, capped), 16px (2.0)                                                                                                                         |
| RTL                                                                                           | tab order mirrored in Arabic (checked in the browser tests and by screenshot)                                                                                             |
| Accessible names                                                                              | the page's accessibility tree has a "Main navigation" landmark with the five tabs named Home, Qur'an, Learn, Progress, Settings (read through DevTools at 2.0 in English) |
| On-device screen sweep at 2.0, English and French (14 screens each)                           | 14/14 clean in both: no overflow and no squeezed words                                                                                                                    |
| Existing smoke suite on a fresh install                                                       | **52/52**                                                                                                                                                                 |

**Limits.** The 2.0 label is 16px, not 15, because Android's WebView will not render text below 8px (before zoom). That is the one place the cap is exceeded, and it still fits. "Screen-reader labels" were verified from the accessibility tree and the existing accessible-name tests, **not** with TalkBack.

**Related defects found and fixed in the same pass (all Android and iOS):**

1. Home tiles broke words mid-word at large Android font scales ("Compre/ndre"), because the grid used `rem`. Columns now also grow with the measured zoom.
2. The Memorize screen's three tiles had a hard-coded 3-column grid, so "Memorize / Revise / Test" stacked letter by letter at AX5.

## 4. iOS accessibility (isolated simulators; simulator evidence only)

| Check                                                                                           | iPhone SE                    | iPhone 17 Pro        |
| ----------------------------------------------------------------------------------------------- | ---------------------------- | -------------------- |
| EN, FR, AR smoke and safe areas, default size                                                   | Pass                         | Pass                 |
| Touch targets and control names, default                                                        | Pass                         | not rerun this phase |
| Reader progress is one element, default                                                         | Pass                         | not rerun this phase |
| Home tiles and About, default                                                                   | Pass                         | not rerun this phase |
| Settings navigation, back, and the Tanzil link opening Safari with app state preserved, default | Pass                         | Pass                 |
| AX3: EN, FR, AR; Reader progress; Settings and link                                             | Pass (5/5)                   | not run this phase   |
| AX5: EN, FR, AR; touch targets; Reader progress; Settings and link                              | Pass                         | EN and AR pass       |
| Landscape insets                                                                                | skipped by design (no notch) | Pass                 |

**Application defects the SE at AX5 found (earlier phases tested AX5 only on the wider Pro), all fixed:**

1. The Surah row's favourite button was 14pt off the right edge.
2. The French Home greeting overflowed by 3pt.
3. The Learn "Levels / Categories" chips overflowed by 9pt.
4. The Home reading card's Arabic name ran off the edge (found by a browser sweep I added).
5. The About source-details grid squeezed values to one character per line (my 007A markup).
6. The Memorize tiles stacked letters (found by the sweep).

**Test-infrastructure and harness problems, kept separate from the defects above:**

- Two failures of the Settings and Tanzil-link test at AX5 were my own scrolling helper overshooting a short link on a very long page; the app was fine. I replaced big swipes with small drags that check after each step, and the test passes.
- One run took 17 minutes because the Mac was busy with unrelated system processes (iCloud sync); the app was healthy. I stopped and re-ran it.
- Earlier (007B) one run failed with an XCTest "background assertion" error and passed on re-run.
- Not infrastructure, but worth saying: three of my Playwright tests could not reproduce WebKit-only problems, so they are labelled as guards and the iOS test is the authority.

**Not claimed.** Nothing here is real-device or live-VoiceOver validation. VoiceOver labels were checked only through XCUITest's accessibility inspection. The link opens Safari in the simulator; it was not tried on a device.

## 5. CI database options and recommendation

Full comparison: `mobile/docs/CI-DATABASE-STRATEGY.md` (nothing implemented, no database read to write it).

| Option                                                                   | Production access | Publishes the DB      | Secrets | Works for forks | Meets all phase requirements |
| ------------------------------------------------------------------------ | ----------------- | --------------------- | ------- | --------------- | ---------------------------- |
| A. Commit or release the file                                            | no                | **yes**               | no      | yes             | no                           |
| B. Encrypted file in git                                                 | no                | ciphertext in history | **yes** | no              | no                           |
| C. Private storage                                                       | no                | no                    | **yes** | no              | no (new service, cost)       |
| D. Owner-triggered re-export from production                             | **yes**           | no                    | no      | no              | no                           |
| **E. Rebuild in CI from repo-pinned sources into a disposable database** | no                | no                    | no      | **yes**         | **yes, if a spike succeeds** |
| F. Owner-attested release (no DB in CI)                                  | no                | no                    | no      | yes             | partly (weakens the gate)    |

**Recommendation: E, gated by an isolated spike** that proves the rebuilt content fingerprint equals `b586ba39…`. **F is the interim** (the release gate stays red on `main` rather than being relaxed) and **D is the approved fallback** only if the spike fails. The earlier 006 recommendation (D) is demoted because it needs production access. What is unproven is stated: fingerprint equality, unattended Kazimirski loading, source availability, and the exporter's local-stack guard.

## 6. Source-verification workflow

Full process: `mobile/docs/SOURCE-VERIFICATION-WORKFLOW.md`. No status was changed and no evidence was collected.

- Ten gates from provenance to monitoring, with roles (steward, independent reviewer, legal reviewer, owner), a per-source dossier, and the project's existing four statuses.
- **Tanzil Uthmani 1.1 (Candidate):** record the artifact and aggregate hashes in the database notes; a full 6,236-ayah comparison against a non-Tanzil reference (KFGQPC); any rasm or wording difference stops the process; legal review of the Bismillah split against the licence's "no changes" condition.
- **Kazimirski (Candidate):** record the Wikisource revision id; a pre-registered sample compared with the scanned edition by two reviewers; bilingual sign-off of the alignment; legal review of the transcription's licence.
- **Pickthall (Verified):** maintenance only (keep the dossier, re-check on change, confirm worldwide public-domain scope). Any failed re-check downgrades it at once.

## 7. Test results

**Pass**

- TypeScript clean.
- Unit tests 103/103.
- Playwright 225/225 (including the 007C font-scale, overflow-sweep and default-size guards).
- ESLint, whole repo: 0 errors (18 existing warnings).
- Prettier: clean except one older warning in `mobile/e2e/android-smoke/README.md` that predates this work.
- Release-artwork guard OK for `dist`, Android and iOS bundles.
- Database verifier OK (counts, fingerprint, file hash).
- Android smoke 52/52; Android font-scale 24/24 per language.
- iOS: as in section 4.

**Mutation-checked (the test fails without the fix):** the tab bar at 1.5 and 2.0, the Home grid reflow, the greeting overflow, and the About value width. **Not discriminating in Chromium (labelled guards):** the search field and Surah-row overflow, because WebKit lays them out differently.

**Fail:** none outstanding. Failures found during the work are listed and resolved in section 4.

**Not run**

- GitHub CI for any of these branches: stacked PRs have non-`main` bases so "QuranRoots CI" does not run, and the 006 fail-closed gate lives on unmerged #85. Local results are not CI success.
- Real devices, TalkBack, live VoiceOver, iPad.
- Android on a screen narrower than 412dp; iPhone 17 Pro AX3; the SE in landscape.

## 8. Remaining release blockers

1. A CI database mechanism is still undecided (spike not approved), so the fail-closed gate stays red on `main`.
2. `main` has no branch protection.
3. French and Arabic strings are drafts awaiting native-speaker review.
4. Artwork rights are unresolved.
5. Tanzil and Kazimirski remain Candidate; the verification process needs named reviewers.
6. iOS bundle identifier and signing are undecided.
7. No real-device, TalkBack or VoiceOver testing yet.
8. The stacked PR chain (#76 to #88) is unmerged and untested by CI; merge order and branch protection are owner decisions.

## 9. Proposed next milestone: QR-DESIGN-007D

1. Push 007C and open its draft PR (on approval).
2. Run the isolated CI-database spike (option E) and report equal or not equal.
3. Name the reviewers and start the source-verification dossiers (documentation first; any database note change is a separate reviewed migration).
4. A real-device pass (Android and iPhone) with TalkBack and VoiceOver.
5. Native-speaker review of French and Arabic.
6. Remaining Design Lock items that need no artwork or new content.

## 10. Decisions requiring owner approval

1. Push `feat/qr-design-007c-release-readiness` and open its draft PR (stacked on #88).
2. Approve the isolated spike for CI-database option E, accept F as the interim, and decide whether D may be used if the spike fails.
3. Approve, amend or reject the source-verification workflow, and name the three reviewers.
4. Branch protection on `main` and the required "mobile release gate" check.
5. Native-speaker review of French and Arabic.
6. Artwork rights, and the iOS bundle identifier and signing decision.
7. Merge order for the stacked PRs (decision only; nothing was merged).
