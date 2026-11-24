# QR-DESIGN-007D: Reproducible Quran content integrity and release safeguards

Written for the project owner. One push happened this phase (the authorised QR-DESIGN-007C branch) and one PR was opened (#89). Everything else is local. No merge, deployment, production access, billing change, artwork publication or status change.

## Corrections to earlier reports (read first)

1. **`main` is protected.** Earlier reports (QR-DESIGN-006 through 007C) and the text of PR #85 said `main` had no branch protection. That was wrong. I had checked only classic branch protection (which returns 404) and not repository rulesets. `main` has an active ruleset (section 8). I corrected PR #85's text; the 007C report and the CI strategy doc are corrected on the local docs branch (not yet pushed). Because of this error, "enable branch protection" is no longer a blocker; whether to require the mobile release gate is.
2. The approved database and its folder are untouched: no sidecar files, the same modification time and the same hash as before this phase.

## 1. Verified Git baseline

| Item                         | Verified                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `origin/main`                | `9f24767` (unchanged)                                                                                               |
| 007C branch                  | `feat/qr-design-007c-release-readiness` = `3e38ce0`, parent `f0873a1` (approved 007B), and 007B local equals remote |
| PRs #68 and #76 to #88       | all open drafts; heads, bases and numbers unchanged                                                                 |
| Approved database            | file SHA-256 `43441fa8…`, fingerprint `b586ba39…1225b1` (verifier OK, 114 surahs, 6,236 ayahs)                      |
| Locked Design Lock originals | all five match `DESIGN_LOCK_MANIFEST.json`                                                                          |

## 2. QR-DESIGN-007C draft PR

[#89](https://github.com/vertexone-dev/quran-fluent/pull/89), **draft**, title "QR-DESIGN-007C — Android Font Scaling, iOS Accessibility, and Release Readiness", base `feat/qr-design-007b-settings-fidelity` (#88), one commit `3e38ce0`. Before pushing: only intended files, no database files, images, env files or keys (pattern hits were the words "secret" and "password" in documentation), based on 007B, no remote branch existed. The PR text states the results, limits, database strategy, verification workflow, dependencies and that deployment is not approved. No CI runs (non-`main` base).

## 3. Database reconstruction outcome

**Succeeded for the content the fingerprint covers; does not cover the curriculum.** `mobile/scripts/rebuild-content-core.mjs` (local CI branch) rebuilds the Arabic text, Pickthall rows, Kazimirski segments and mappings from five files already committed to the repository, each pinned by SHA-256, with no database, network, secret or production access, writing only to a temporary directory.

## 4. Canonical fingerprint comparison

|                                | Rebuilt                                                            | Approved                                                           |
| ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Content fingerprint            | `b586ba395b9508f1918175bc1c37e0c113ed5c6505a0aa6fec4286469d1225b1` | `b586ba395b9508f1918175bc1c37e0c113ed5c6505a0aa6fec4286469d1225b1` |
| Surahs / ayahs                 | 114 / 6,236                                                        | 114 / 6,236                                                        |
| Pickthall rows                 | 6,236                                                              | 6,236                                                              |
| Kazimirski segments / mappings | 6,239 / 6,396                                                      | 6,239 / 6,396                                                      |

A row-by-row comparison with a temporary copy of the approved database found **zero** differing rows in `ayahs`, `translations`, `translation_segments`, `translation_segment_ayahs` and `surahs` (names, which the fingerprint does not hash). The file SHA of the rebuilt core (`f0190ef9…`) is not comparable: it is a different, smaller file; content, not file bytes, is what is compared. Also verified: the raw Wikisource HTML hashes to the manifest's `source_artifact_sha256`; every segment's text hash and the manifest's aggregate hash recompute; my `uuid5` equals Python's for the segment ids.

**What it proves and does not.** It proves the approved content equals the content committed in the repository. It does **not** prove that content equals the original Tanzil, Gutenberg and Wikisource files (no network, no re-fetch). That is the source-verification workflow's job.

## 5. Missing or unapproved source inputs

- **Nothing was missing** for the fingerprinted content, and nothing was downloaded.
- **Not rebuilt (outside the fingerprint):** curriculum tables (courses to lessons, exercises, vocabulary, word frequency), `content_sources` and the per-locale overrides. Their ids come from the production database, and the Kazimirski import used a Postgres adapter, so they need a disposable Supabase stack (a separate spike).
- **Original third-party files were not re-fetched:** the Tanzil, Gutenberg and Wikisource hashes are recorded, not re-verified.
- **Rights or provenance questions found while inventorying (questions, not conclusions):**
  1. The migration that holds the full Tanzil text names the source and its checksum but has **no copyright notice or licence line**, which Tanzil's terms ask to appear in files containing a substantial portion of the text; the repository is public.
  2. The 58 bootstrap ayahs came from `api.alquran.cloud` (edition `quran-uthmani`), not the Tanzil download, but are credited to Tanzil.
  3. Wikisource's licence for its transcription of Kazimirski is unreviewed.
  4. Pickthall is recorded as public domain in the United States only; worldwide scope is unconfirmed.

## 6. CI implementation proposal (local branch, not pushed)

`ci/qr-design-007d-reproducible-content` at `5ad2a0f`, based on the fail-closed CI branch (#85) because it needs that branch's verifier.

- New always-on job **`content-integrity`**: no database, variable or secret; read-only permissions; runs on pull requests (including forks) and pushes; fails if a pinned input changed, a count or text hash is wrong, or the fingerprint differs. Path filters now include the rebuild's inputs (`supabase/migrations/**`, `scripts/quran-import/kazimirski/**`).
- The **release gate now also requires it**, and still requires the full-database job. Nothing is relaxed; the gate stays red until the full database is available.
- 17 unit tests (not database-gated, so unskippable): the pass case, a changed Arabic letter, a changed Pickthall word, changed Kazimirski text, a dropped mapping, a missing ayah, a wrong fingerprint, unsafe `--out`, and the SQL parser's edge cases.

**Verification actually run:**

| Check                                                                                                        | Result                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Rebuild on the clean repo                                                                                    | exit 0, fingerprint equal                                                |
| One byte changed in the Tanzil migration                                                                     | refused (exit 1: pinned input changed)                                   |
| Kazimirski manifest text changed                                                                             | refused                                                                  |
| Pinned fingerprint altered                                                                                   | refused (fingerprint mismatch)                                           |
| A lock pin altered                                                                                           | refused                                                                  |
| `--out` inside the repository / no `--out`                                                                   | refused / usage error                                                    |
| Fresh clone, no `.env`, no database, stripped environment                                                    | rebuild passes; 17/17 tests pass; `assert-no-skips` OK                   |
| A deliberately skipped test                                                                                  | `assert-no-skips` fails                                                  |
| Branch tests: no database / `REQUIRE_CONTENT_DB=1` without a database / with a copy of the approved database | skips / **fails (exit 1)** / **109/109 pass, none skipped**, verifier OK |
| `actionlint`                                                                                                 | clean                                                                    |

**Not run:** GitHub Actions itself (nothing was pushed). Fork compatibility is by construction (`pull_request`, read-only, no secrets), verified by the stripped-environment replay, not by a real fork PR.

**Revised database recommendation.** Adopt this rebuild now (always-on integrity). Keep the gate fail-closed. Spike a full-database rebuild (disposable Supabase stack plus a guarded local target for the exporter) separately. Production re-export is **not** used as a fallback, as instructed; the interim is the owner building releases from the approved file locally.

## 7. Source-verification review packets

Local docs branch `docs/qr-design-007d-verification-packets` (`4173df9`), in `mobile/docs/review-packets/`:

- **Arabic / Qur'an text packet:** question, evidence, reference and method (all 6,236 ayahs; category (a) formatting vs (b) rasm, diacritic or wording; any (b) stops), acceptance checklist, the 58-ayah stratum, the Bismillah split.
- **French translation packet:** transcription (two readers), alignment and quality (bilingual reviewer), language; a **reproducible, seed-registered sample** (`mobile/scripts/draw-review-sample.mjs`, 6 tests, all 114 surahs covered).
- **Legal and licensing packet:** questions L1 to L5 (terms, attribution, modification, redistribution, provenance) and evidence to attach.
- A README with the independence and fail-safe rules, and a findings-log template (one row per finding, severity, disposition, owner decision).

**Workflow evaluation:** the ten gates were evaluated against your ten categories. Two gates were missing and are added as G4a (reproducibility, now evidenced) and G6a (transformation history); provenance gains a per-stratum rule; translation attribution and language review are tightened. A per-source status snapshot marks only the rebuild as re-verified this phase. **No reviewer is named, qualified or approved, and no source status changed** (Tanzil Candidate, Kazimirski Candidate, Pickthall Verified).

## 8. GitHub ruleset findings (read-only API calls; nothing changed)

| Item                           | Finding                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rulesets                       | one, "Protect main", **active**, targets the default branch `main`                                                                                                                                                                         |
| Pull requests                  | required; **1 approving review**; stale approvals dismissed on push; review threads must be resolved; merge, squash and rebase all allowed; no code-owner review (no CODEOWNERS file)                                                      |
| Required status checks         | one: `test` (GitHub Actions, "QuranRoots CI"); branch must be **up to date** with `main`                                                                                                                                                   |
| Force push / deletion          | both **blocked** (`non_fast_forward`, `deletion`)                                                                                                                                                                                          |
| Admin bypass                   | **yes**: the repository Admin role can bypass the ruleset "always". The token used here reports `current_user_can_bypass: always`. It was not used and must not be                                                                         |
| Classic branch protection      | none (404); the ruleset is the control                                                                                                                                                                                                     |
| Production environment         | required reviewer (one user); **self-review is not prevented**; admins cannot bypass; deployment limited to branch `main`; environment holds a Cloudflare token (secret name only) and variables including `VITE_BILLING_CHECKOUT_ENABLED` |
| Production workflows           | `Production Deployment` triggers **only** on completion of a workflow named exactly "QuranRoots CI" on `main`, or manually; `Production Validation` is manual only. A workflow named "QuranRoots Mobile CI" cannot trigger or gate either  |
| Pending production deployments | run `44967138877` for `9f24767` is pending (created 2026-11-22), and an older run `43080211371` is waiting. **Neither was approved**                                                                                                       |
| Actions                        | all actions allowed, no SHA pinning required; default token read-only; Actions cannot approve PRs                                                                                                                                          |
| Repo secrets / variables       | secrets: E2E credentials and Supabase keys (names only); **no repository variables** (so `MOBILE_CONTENT_DB_URL` is unset)                                                                                                                 |

**Cannot be verified from here:** who the second approver could be (the PRs are authored by the owner's account, which cannot approve its own PR); whether any organisation-level rules apply; whether `test` also covers mobile (it does not; Mobile CI is separate and not required); behaviour on a real fork.

## 9. Recommended PR integration order (a recommendation; nothing executed)

Graph: web stack #77 -> #82 -> #86; mobile stack #76 -> #78 -> #79 -> #80 -> {#81 -> #85, #83 -> #84 -> #87 -> #88 -> #89}; #68 separate. All stacked PRs are clean against their bases and against `main`; every PR except #68 is up to date with `main` (#68 is 35 commits behind). #76 and #77 have a passing `test` check; #78 to #89 have none (non-`main` bases).

1. **Decide the approver first.** The ruleset needs one approval from someone other than the author. Using admin bypass to avoid this is possible but is the thing the ruleset exists to prevent.
2. **#76** then **#77** (independent). Use a **merge commit, not squash or rebase**, so the stacked histories stay valid. A merge to `main` runs "QuranRoots CI" and queues another pending production deployment: **do not approve it**.
3. **Retarget #78 to `main`** (the head branch is not deleted on merge, so GitHub does not retarget automatically). Retargeting may not start CI, so a push or reopen may be needed to get the required `test` check. Then merge #78, #79, #80 in order.
4. Then #81 and #83 (siblings, clean), then #84, #85, #87, #88, #89 in dependency order; on the web side #82 then #86.
5. **Release-gate dependencies:** once #81 and #85 merge, Mobile CI runs on pushes to `main`; its release gate is red until a full-database mechanism exists, but it is not a required check, so merges are not blocked. If the 007D CI branch is approved and merged, `content-integrity` will be green.
6. **#68** conflicts with the chain (9 files at #76, 13 at the tip). Treat it as superseded or rebase it by the owner's decision; do not merge it alongside the chain.
7. Keep every head branch until its child is retargeted.

**Potential deployment triggers:** merging anything to `main` runs "QuranRoots CI" there, which queues the production deployment run (approval required). No mobile or review workflow can start it.

## 10. Accessibility and device readiness

**Verified this phase (isolated simulators and emulator only):**

| Platform                                | Result                                                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android emulator, 412dp                 | smoke **52/52** (fresh install); tab bar at font scale 1.0, 1.3, 1.5, 2.0 in EN, FR and AR (24 checks each, from 007C)                                  |
| Android emulator at **360dp and 320dp** | tab bar **24/24 in English at both**, and in **French and Arabic at 320dp**; on-device sweep at 2.0 clean on 14 screens for each combination            |
| iPhone 17 Pro                           | default: touch targets, Reader progress, Home and About pass; **AX3**: EN, FR, AR and Settings with the Safari link pass (AX5 EN and AR passed in 007C) |
| iPhone SE                               | all runs from 007C (default, AX3, AX5; EN, FR, AR)                                                                                                      |

**Still needed (not done, and not claimable from simulators):** Android real-device testing and **TalkBack**; iPhone real-device testing and **VoiceOver**; Android narrower than 320dp and tablets; iPhone 17 Pro AX5 in French (last run in 007B); the SE in landscape (skipped by design: no notch). No devices were bought, no accounts registered, no Apple signing touched.

## 11. Remaining Emergent design discrepancies

Unchanged by this phase (no design file touched; originals verified). Recorded for the later artwork-alignment phase:

- **Needs approved artwork (blocked by the release guard):** launch screen, Home and Settings banners, ornate frames and lanterns, thumbnails.
- **Needs verified content:** Juz', surah meanings and diacritic spellings, tafsir, word-by-word, Key Lessons, Reflect prompts and chips.
- **Future features (each needs approval):** profile card and notification bell, audio, share and the pager, memorization and progress figures, Family Mode, learning journeys, the Settings rows for audio, notifications and family.
- **Kept as approved:** the six-tile Home with Bookmarks, the Settings sub-pages, About & Sources, the logo and the palette.

## 12. Test results

**Pass (executed):**

- 007C app code: TypeScript clean; unit 103/103; Playwright 225/225; ESLint 0 errors (18 warnings); Prettier clean except one older warning in the Android smoke README; release-artwork guard OK.
- CI branch: 17/17 rebuild tests; branch suite 109/109 with a database copy and none skipped; fail-closed cases as in section 6; `actionlint` clean.
- Docs branch: sampler tests 6/6.
- Database verifier OK; originals unchanged.
- Android smoke 52/52; narrow-width and sweep checks as in section 10.
- iOS simulator runs as in section 10 (7 of 7 this phase on the Pro).
- Source attribution: covered by the Playwright About tests (statuses Candidate, Verified, Candidate; Tanzil notice and link).

**Not run:** GitHub CI for any new work; real devices, TalkBack, VoiceOver; the full-database rebuild (curriculum); an actual fork PR. The docs worktree has no `node_modules` or database, so its TypeScript and database-backed tests were run on the 007C worktree, whose application code is identical.

## 13. Release blockers

1. No full-database mechanism for CI (the content rebuild covers only the fingerprinted content); the release gate stays red on `main` by design.
2. Source verification has not started: no reviewers named; Tanzil and Kazimirski remain Candidate.
3. Open licensing questions (Tanzil notice in the migration, the 58-ayah provenance, the Wikisource transcription, Pickthall worldwide scope).
4. French and Arabic strings are drafts awaiting native-speaker review.
5. Artwork rights are unresolved.
6. iOS bundle identifier and signing are undecided.
7. No real-device, TalkBack or VoiceOver testing.
8. The 14-PR stack (#76 to #89) is unmerged, untested by CI and needs a second approver under the ruleset; #68 conflicts with it.
9. The Admin bypass on the `main` ruleset and the production environment's non-blocked self-review are risks the owner should decide on.

## 14. Exact owner approvals needed

1. Push `ci/qr-design-007d-reproducible-content` (stacked on #85) and open its draft PR, to put the always-on content-integrity job under review.
2. Push `docs/qr-design-007d-verification-packets` (stacked on #89) and open its draft PR (packets, workflow revision, the corrections above).
3. Approve a spike for the full-database rebuild (disposable local stack; no production), or choose to keep releases built locally from the approved file.
4. Approve the verification workflow, and **name** the Arabic, French and legal reviewers (nothing starts without people).
5. Decide whether to require the "mobile release gate" (or `content-integrity`) as a required check on the existing ruleset.
6. Decide on the ruleset's Admin bypass and the production environment's self-review setting (change nothing without your say).
7. Provide a second approver for the stack, or choose how approvals will be handled; decide #68's fate.
8. Native-speaker review of French and Arabic; the artwork-rights decision; the iOS bundle identifier and signing.

## 15. Recommended next milestone: QR-DESIGN-007E

1. Put the two local branches under review (approvals 1 and 2).
2. Run the full-database rebuild spike, in isolation.
3. Start the source-verification dossiers with the named reviewers: Pickthall maintenance and the Arabic G3 metadata first.
4. A real-device pass with TalkBack and VoiceOver.
5. Resolve the licensing questions in section 5.
6. Walk the merge sequence in section 9 once an approver is available.

_Read, understand, reflect, practice, grow. Essential Quran education remains free._
