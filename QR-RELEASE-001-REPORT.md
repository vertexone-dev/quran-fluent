# QR-RELEASE-001: Independent review and integration readiness

Written for the project owner. A preparation and verification phase: nothing was merged, retargeted, deployed or signed; no ruleset, billing, production database, source status, Quran text or artwork was touched. I am the author of most of the code reviewed, so this is **not** an independent approval; the matrix lists what an independent reviewer must still confirm.

## 1. Verified repository baseline (fetched 2026-11-23)

- `origin/main` = `9f24767`. It includes the website's Milestone C work (the owner's local `feat/qr-int-008-milestone-c-integration` has 0 commits beyond main).
- 19 open draft PRs, all mergeable per GitHub, heads as below. Remote heads for #90 and #91 are unchanged (`5ad2a0f`, `77f45f9`).
- Secrets scan of the diffs from `main` to the heads of #92 and #93 (private-key blocks, JWT-shaped strings, AWS, GitHub and Stripe-style tokens): nothing found. The only password strings are the disposable local `postgres` values in the rebuild script and a per-run random JWT secret.
- Binary files in the stacks: Android and iOS launcher icons and splash screens (the approved logo and emblem), `mobile/public/art/*.jpg` (4 AI-generated images, pruned from release builds by the artwork guard), `mobile/public/brand/quranroots-emblem.png`, `mobile/public/quranroots-logo.png`. No database, key, provisioning profile or `.env` file.
- Untracked files in the owner's checkout, in no PR: `.scratch-levelaudit.mjs`, `scripts/quran-import/KAZIMIRSKI-RESEARCH.md`, `supabase/.branches/`.
- Unrelated old stash in the CI worktree and the local backup branches `backup/007e-original-stash` and `backup/007e-content-full-run` are kept.

## 2. Temporary branch cleanup

`ci/qr-design-007e-content-full-run` had two commits beyond #92: the one-line temporary trigger (`a5e22b5`) and a cherry-pick of a fix that is also in #92 (`git cherry`: equivalent patch present in #92). The tree difference to #92 was only that one line. Nothing unique was lost, so **only that remote branch was deleted**. A local backup branch points at its tip `4f8a9d2`.

Evidence preserved: run [45172445848](https://github.com/vertexone-dev/quran-fluent/actions/runs/45172445848) is still `success` (deleting a branch does not delete runs). Copies of its JSON and full log are in the session scratchpad (`evidence/run-45172445848.json` SHA-256 `158d3ef2…4465`, `.log` SHA-256 `d74f35b0…39d0`). Jobs: content status, content integrity, **content-full**, static checks and **release gate** all success; "approved database" job skipped by design. 121 unit tests none skipped; both pinned fingerprints matched.

## 3. PR dependency graph

```
main 9f24767
├─ #76 mobile screens (base main, CI test pass)
│  └─ #78 004a polish
│     └─ #79 004b iOS safe area
│        └─ #80 004c iOS localisation
│           ├─ #81 005 mobile CI
│           │  └─ #85 006 fail-closed gate
│           │     └─ #90 007D reproducible content
│           │        └─ #92 007E full rebuild + symlink fix + content-full
│           └─ #83 005 iOS accessibility
│              └─ #84 006 dynamic type
│                 └─ #87 007A visual alignment
│                    └─ #88 007B settings fidelity
│                       └─ #89 007C release readiness
│                          └─ #91 007D verification packets
│                             └─ #93 007E materials (+ this report once pushed)
├─ #77 web settings (base main, CI test pass)
│  └─ #82 005 web settings isolation
│     └─ #86 006 web settings e2e
└─ #68 004 D1 integration (base main, older overlapping mobile work)
```

**#68:** GitHub says mergeable against `main` alone, but it rewrites the same mobile files as the #76 chain: a trial merge gives conflict hunks against #76 (32) and against the stack head (43). Merging either side first leaves the other conflicted. Decision for the owner: close #68 as superseded, or rebase it after the stack. I did not alter it.

## 4. Review matrix

Severity: High = blocks release or merge; Medium = fix or decide before release; Low = note.

| #   | Area                      | Finding                                                                                                                                                                                                                                              | Sev               | Evidence                                                       | Required fix / decision                                                                                  |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | CI / deployment           | The ruleset requires only the check `test` (web CI). The mobile checks, including `content-full` and the release gate, are **not required**, so mobile code can merge without them                                                                   | High              | `rules/branches/main`: `required_status_checks: test` only     | Owner: add the mobile release gate as a required check (ruleset change, not made here)                   |
| 2   | CI reliability            | Stacked PRs have no CI: workflows trigger on PRs to `main` only. Only #76 and #77 have `test` results. Everything above was verified locally and by one manual run                                                                                   | High              | `gh pr checks`: no checks on #89, #90, #92                     | After each retarget, wait for fresh checks; do not rely on local results                                 |
| 3   | CI reliability            | `test` takes about 47 to 51 minutes and the ruleset requires an up-to-date branch, so merging 19 PRs one by one costs many hours of repeated runs                                                                                                    | Medium            | #76: 47m24s; #77: 51m0s                                        | Owner: choose the integration strategy in section 9                                                      |
| 4   | Security / fail-closed    | Five verification scripts could exit 0 having verified nothing when started through a symlink. Fixed in #92 (5 scripts) and #93 (sample script). **#85, #90 and #91 still contain the old guard**                                                    | High until merged | tamper test passed incorrectly; new tests fail without the fix | Merge #92 and #93 before relying on those gates; an independent reviewer should re-run the mutation test |
| 5   | Deployment risk           | Production Deployment run 44967138877 for `9f24767` is **pending approval**, and a second run is waiting. The production environment's reviewer can self-approve. Each push to `main` queues another                                                 | High              | `gh run list`; owner's earlier notes                           | Owner: leave unapproved until the release decision; consider requiring a second reviewer                 |
| 6   | Deployment risk           | "Production Deployment" triggers only on completion of the workflow named exactly "QuranRoots CI" on `main`. The mobile workflow is named "QuranRoots Mobile CI", so mobile CI cannot start a deployment. Renaming either workflow would change that | Low               | workflow names; run 45172445848 started nothing in production  | Keep the names distinct; mention in review                                                               |
| 7   | iOS release               | iOS bundle identifier is `com.quranroots.mobilefeasibility`; Android's is `com.quranroots.app`. Signing is automatic with the "iPhone Developer" identity and no development team set                                                                | High              | `project.pbxproj`, `build.gradle`                              | Owner decides the identifier and team; not changed here                                                  |
| 8   | Android                   | `allowBackup="true"`: app data (bookmarks, notes, progress in WebView storage) can be included in device backups. No release signing config, `minifyEnabled false`, `versionCode 1`                                                                  | Medium            | `AndroidManifest.xml`, `build.gradle`                          | Decide on backup policy and signing before a store build                                                 |
| 9   | Security                  | The mobile `index.html` has no Content-Security-Policy. The app loads only bundled files and an allowlisted external link (tanzil.net) that opens in the system browser                                                                              | Medium            | no CSP found in `index.html` or `src`                          | Add a restrictive CSP and test it on both platforms                                                      |
| 10  | Database integrity        | Rebuild from repository files reproduces the approved Quran content (fingerprint `b586ba39…`) and all 20 tables (`b04a3c5a…ab780`); app tests pass on it. The file bytes are not reproducible, so the approved file hash cannot be recomputed        | Low               | run 45172445848; 007E experiment                               | Keep both pins; independent reviewer should re-run the rebuild                                           |
| 11  | Database integrity        | The rebuild trusts text committed in migrations; the original Tanzil, Gutenberg and Wikisource files were not re-fetched, except Tanzil, which was compared in 007E and matches the pinned hash                                                      | Medium            | 007E report                                                    | Re-fetch and hash the other two sources in a reviewed step                                               |
| 12  | Database integrity        | The 58 bootstrap ayahs mix Unicode forms (not all NFC) and use different marks from the other 6,178                                                                                                                                                  | Medium            | 007E measurement                                               | Arabic reviewer decides; any change is a separate reviewed migration                                     |
| 13  | Licensing                 | Tanzil "no changes" term against the Bismillah split and removal; missing copyright block in public migration `20260820160000`; 58 ayahs credited to Tanzil but sourced from api.alquran.cloud                                                       | High              | official file header; migration headers                        | Legal reviewer; correct attribution in a reviewed migration                                              |
| 14  | Licensing                 | Wikisource transcription licence (Kazimirski) and Pickthall's US-only public-domain record unreviewed                                                                                                                                                | High              | source rows in `content_sources`                               | Legal reviewer                                                                                           |
| 15  | Licensing / artwork       | Four AI-generated mobile images and the website's cinematic images have no written commercial-rights record. The guard prunes them from release builds; the current dev website still shows them                                                     | High              | `ARTWORK-RELEASE.md` (mobile and website)                      | Owner: obtain rights or keep blocked. Never publish a build that skips the guard                         |
| 16  | Accessibility             | Tab bar and screens verified on Android emulator and iOS simulators at large text (007C). Not verified with TalkBack, VoiceOver, real devices, or iPad. French and Arabic strings are drafts                                                         | High for release  | 007C report                                                    | Real-device and screen-reader pass; native review                                                        |
| 17  | Android and iOS stability | Android smoke 52/52 and font-scale 24/24 per language; iOS XCUITest on iPhone SE and 17 Pro pass (simulator). Nothing on real hardware                                                                                                               | Medium            | 007C report                                                    | Real-device testing                                                                                      |
| 18  | CI reliability            | `content-full` pulls public container images and runs Docker on a hosted runner; it passed once (about 4 minutes). Flakiness, image rate limits and cost of repeated runs are unmeasured                                                             | Low               | one run                                                        | Watch the first merges; keep the job's timeout                                                           |
| 19  | Governance                | The ruleset lets the Admin role bypass it, and one approval from a non-author is required. Who the second approver is has not been named                                                                                                             | Medium            | ruleset                                                        | Owner decision                                                                                           |
| 20  | Process                   | Earlier I reported `main` as unprotected (it had a ruleset); corrected in earlier PRs                                                                                                                                                                | Low               | PR #85 text                                                    | None                                                                                                     |

## 5. CI and content-integrity findings

- Always-on `content-integrity` job (rebuilds the fingerprinted Quran content from pinned files) and the `content-full` job (the whole database in Docker) both passed on GitHub; the release gate depends on static, content-integrity and content-full.
- Fail-closed behaviours covered by tests: wrong pin, altered Arabic letter, dropped mapping, skipped tests (`assert-no-skips`), release artwork present, symlink start.
- Not proven: behaviour on a runner under load, a run triggered by a real PR to `main`, and the interplay with the ruleset.

## 6. Arabic, French and legal blockers

Packages: `mobile/docs/review-packets/REVIEWER-PACKAGES.md` and the three packets. Blockers: no named reviewers; Arabic mark and Bismillah decisions for the 58 ayahs; French review of Kazimirski, alignment and UI text; legal items 13 and 14. Tanzil and Kazimirski remain Candidate, Pickthall Verified, Hamidullah disputed and excluded.

## 7. Original design fidelity (Design Lock v1.0)

The five originals match `DESIGN_LOCK_MANIFEST.json` by SHA-256 (verified again today). I compared the current website and mobile app by screenshot on 2026-11-23 (website at 1440 px from the local `main` checkout; mobile at 390 px from the 007C worktree) and used the documented 007A and 007B comparisons for Settings.

**Exact or very close matches:** website Home layout, nav order, five feature cards, "Your Journey" strip and hero copy (`01_website_homepage.png`); the Midnight Teal, Antique Gold and Ivory palette; Settings as one list of category rows (`05`); the mobile hero wordmark and five-tab bar.

**Remaining differences:**

- Mobile Home shows six tiles (Qur'an, Understand, Learn, Reflect, Memorize "Not available yet", Bookmarks); the design has Family Mode and a "Your Journey 42%" card, here replaced by "Start reading". Tab five is Settings, not Profile.
- No launch and onboarding artwork as drawn; the mobile Reader, Understand, Reflect, Memorize and Progress screens follow the structure but not the ornate gold frames, lantern art or circular progress ring.
- Website: no notification bell; the design shows a 42% progress sample and a "Resume" button that are real-data driven here ("Create account" for signed-out users); no glow effects on the primary button.
- Settings: no profile, audio, notification or family rows (the features do not exist); "About & Sources" instead of "About QuranRoots".

**Missing or blocked assets:** all painted artwork (hero, journeys, banners) is AI-generated with no rights record, so release builds use the CSS-only treatment. No replacement artwork was generated.

**Website and mobile inconsistencies:** the website's feature set (accounts, Guided Learning, Learn Arabic) is larger than mobile's (no accounts; Memorize unavailable); labels differ (Guided Learning vs Learn; Settings vs Profile).

**Accessibility constraints:** text at 2.0 scale forces larger labels and reflowed grids that cannot mirror the poster layouts; touch targets are at least 44 pt; reduced motion is respected.

## 8. Readiness

### Mobile (Android and iOS): **not ready for release**

Checklist (every item is open unless marked):

1. Real-device testing on at least one Android phone and one iPhone, and a tablet decision. Open.
2. TalkBack pass (Android) and VoiceOver pass (iOS) on every screen. Open.
3. Bundle identifier decision and consistency across Android, iOS and the Capacitor config. Open.
4. iOS signing: team, certificates, provisioning profiles, automatic or manual; Android upload key and Play App Signing. Open.
5. Version numbers and build numbers policy. Open.
6. Android `allowBackup`, minification and CSP decisions. Open.
7. Artwork rights or confirmed CSS-only builds; run the artwork guard on the actual store bundles. Open (guard exists and passed).
8. Native French and Arabic review. Open.
9. Privacy policy and store data-safety forms (the app is offline; notes and progress stay on device). Open.
10. Source attribution and licence screen reviewed by the legal reviewer. Open.
11. Test on narrow phones at the largest text: done in simulators and an emulator. Done (simulator evidence).
12. Store accounts and any fees: not authorised.

### Website: **not ready for a decision beyond what is on `main`**

`main` already contains the Milestone C website and CI is green for it; the web PRs #77, #82 and #86 add Settings work (only #77 has a `test` result). Open: artwork rights (cinematic images are blocked from release builds by the website's own guard), the pending production deployment decision, French and Arabic review, and the Supabase and secrets setup, which I did not touch.

## 9. Recommended integration sequence (not executed)

Merge method: **merge commits**, not squash or rebase, so each child branch keeps its ancestry and diffs stay clean. Squashing would force rebasing published branches, which AGENTS.md forbids.

Option A, sequential (most reviewable, slowest): within each chain merge the lowest PR, let GitHub or the owner retarget the next to `main`, wait for fresh checks, update the branch, merge.

1. Chain M (mobile): #76, #78, #79, #80, then #83, #84, #87, #88, #89, #91, #93 on one branch and #81, #85, #90, #92 on the other (both continue from #80, so after #80 merges, retarget #81 and #83 to `main`).
2. Chain W (web): #77, #82, #86 (independent of chain M).
3. #68: decide before starting (close or rebase).
4. Order within the CI branch matters: #92 right after #90; #93 right after #91.

Option B, consolidated (fewer CI runs): after the owner is satisfied, open one integration PR per chain from its tip; review is coarser but `test` runs once per chain.

**Retargeting needed after approved merges:** after #80 merges, #81 and #83 move to `main`; after #81, #85 moves; after #85, #90; after #90, #92. After #83, #84; then #87, #88, #89, #91, #93 in turn. After #77, #82; after #82, #86. Retargeting changes PR bases and was not done.

**Checks that must pass on every PR to `main`:** `test` (required) plus, by owner decision, the mobile release gate. **Deployment trigger:** each merge to `main` runs "QuranRoots CI"; on success it creates a "Production Deployment" run waiting for the production reviewer. Approve none until the release decision. Merging does not deploy by itself.

## 10. Remaining owner approvals

1. Integration strategy (A or B), merge method, and whether to add the mobile gate as a required check.
2. Fate of #68.
3. Named Arabic, French and legal reviewers; a second approver for PRs and for the production environment.
4. Permission to push this branch (`docs/qr-release-001-review-and-integration`, local only for now) and open a draft PR.
5. Bundle identifier, signing, store accounts and fees.
6. Artwork rights.
7. Backup, CSP and signing decisions for Android.
8. Production deployment runs (leave unapproved until decided).
