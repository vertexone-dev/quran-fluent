# QR-DESIGN-007E: Finalization (second approval)

Written for the project owner. This section supersedes the "not pushed", "CI not run" and stash statements below. Nothing was merged or deployed; no ruleset, billing, production database or artwork was touched; no source status or Quran content changed.

| Item                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft PR, CI                 | [#92](https://github.com/vertexone-dev/quran-fluent/pull/92), `ci/qr-design-007e-full-db-rebuild`, base `ci/qr-design-007d-reproducible-content` (#90). Pushed as a new branch; existing PR heads (`5ad2a0f`, `77f45f9`) unchanged, no force push                                                                                                                                                                                                             |
| Draft PR, docs               | [#93](https://github.com/vertexone-dev/quran-fluent/pull/93), `docs/qr-design-007e-verification-materials`, base `docs/qr-design-007d-verification-packets` (#91)                                                                                                                                                                                                                                                                                             |
| Stash recovery               | Backups made first: branch `backup/007e-original-stash` (local) at the stash commit `bf8bd4b3…`, the patch of the accidental pop, and a copy of the conflicted file, in the session scratchpad. Then the three affected files were restored from HEAD. The worktree is clean and the original stash is still present. No conflict was resolved by guessing: the stash contents were not applied                                                               |
| Pre-push checks              | remote heads unchanged; ancestry confirmed; clean trees; diff scanned for secrets (only local disposable `postgres` passwords and a per-run random JWT secret) and for database or image files (none); three "wip" commits squashed before first push                                                                                                                                                                                                         |
| GitHub run of `content-full` | Throwaway branch `ci/qr-design-007e-content-full-run` (temporary push trigger; **not** in #92; contains no production access). Run [45172445848](https://github.com/vertexone-dev/quran-fluent/actions/runs/45172445848): **all jobs green**, `content-full` about 4 minutes, both pinned fingerprints matched on the runner, 121 unit tests in 12 files none skipped, Playwright, release gate passed. `QuranRoots CI` and Production Deployment did not run |
| First attempt                | Run 45171604352 failed: the rebuild and both fingerprints passed, but the unit-test step failed because the approved-file-hash test cannot pass for a rebuilt file, and two export tests looked in `mobile/content-db/`. This was my test setup, not a content problem. Fixed (the test now requires that a rebuilt file's content check passes and its file-hash check fails for exactly that reason) and the DB is also placed in `mobile/content-db/`      |
| Symlink fix                  | five scripts in #92 (`assert-no-skips`, `verify-content-db`, `release-art-guard`, `rebuild-content-core`, `full-content-fingerprint`) plus `draw-review-sample` in #93. All five run when started through a symlink; the new tests fail without the fix                                                                                                                                                                                                       |
| Local tests                  | 70/70 script tests with the rebuilt DB; 7/7 sample-script tests                                                                                                                                                                                                                                                                                                                                                                                               |

## Official Tanzil comparison (read-only)

Downloaded once from the official download URL to the scratchpad (not in any repository, not redistributed). The file's SHA-256 equals the checksum pinned in migration `20260820160000` (`6933e133…`); it is headed "Tanzil Quran Text (Uthmani, Version 1.1), Copyright (C) 2007-2026 Tanzil Project, License: Creative Commons Attribution 3.0".

- Terms in the file: verbatim copies only ("changing it is not allowed"), credit Tanzil Project with a link to tanzil.net, and reproduce the copyright block in derived files.
- 58 bootstrap ayahs: 21 byte-identical; 31 differ only by tatweel and small marks; 6 differ because the Bismillah was removed from ayah 1 (surahs 67, 103, 108, 112, 113, 114). Letter skeleton identical in 52 of 58, and in the other 6 the only difference is that prefix. **No wording difference.**
- Rights finding: the 58 are not Tanzil's text as distributed, and the Bismillah removal is an edit relative to the "no changes" term. Migration `20260820160000` does not reproduce Tanzil's copyright block.

## Remaining source-review blockers

1. Legal: "no changes" term against the Bismillah split and removal, attribution of the 58 (api.alquran.cloud text credited to Tanzil), the missing copyright block in the public migration, Wikisource licence, Pickthall scope (US only).
2. Arabic reviewer must still judge the mark and tatweel differences for the 58 and compare against a non-Tanzil reference (KFGQPC); not done.
3. French and Arabic native review: not done. The 58 Hamidullah French rows remain disputed and excluded.
4. Named reviewers and a second approver; Kazimirski and Tanzil remain Candidate.
5. #85, #90, #91 still contain the old entrypoint guard until #92 and #93 are merged into them.
6. Not done: real devices, TalkBack, VoiceOver; artwork rights; iOS bundle ID and signing.

The throwaway branch `ci/qr-design-007e-content-full-run` should be deleted after you have looked at the run (not deleted by me).

---

# Earlier report (before the second approval)

Written for the project owner. Nothing was merged, deployed, or changed in production, and no source status was changed. The only publications were the two draft PRs you authorised. Everything else is local.

## 1. Pushes and PRs (both verified before pushing)

| Item               | Result                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI branch          | `ci/qr-design-007d-reproducible-content` @ `5ad2a0f`, draft [#90](https://github.com/vertexone-dev/quran-fluent/pull/90), stacked on #85                         |
| Docs branch        | `docs/qr-design-007d-verification-packets` @ `77f45f9`, draft [#91](https://github.com/vertexone-dev/quran-fluent/pull/91), stacked on #89                       |
| Not pushed (local) | `ci/qr-design-007e-full-db-rebuild` (3 commits, tip `98521fb`) and `docs/qr-design-007e-verification-materials` (tip `153e15d`, plus this report once committed) |

## 2. Full-database reconstruction experiment (succeeded)

Rebuilt in disposable Docker containers (Postgres and PostgREST on loopback ports, a random JWT secret) from repository files only: all 47 migrations, the committed Kazimirski manifest and the review decisions. No production access, no external download, no owner database or local Supabase stack touched. Run three times with identical results.

| Check                                                               | Result                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Quran content fingerprint (`b586ba39…`)                             | **equal** to the approved database (114 surahs, 6,236 ayahs, 6,236 EN, 6,239 segments, 6,396 joins) |
| Full-content fingerprint, 20 tables, 27,247 rows (`b04a3c5a…ab780`) | **equal** (database-generated ids replaced by natural keys)                                         |
| App unit tests on the rebuilt database                              | 103/103, none skipped                                                                               |
| Playwright on the rebuilt database                                  | 225/225                                                                                             |

**Differences found, none in content:** the file bytes (generated timestamps, random ids), `content_version`, and the random ids of 5 `content_sources` rows (statuses identical). The approved file hash is therefore not reproducible; the two fingerprints are.

**Not rebuilt:** the original third-party artefacts (Tanzil, Gutenberg, Wikisource) were not re-fetched. The rebuild trusts the text committed in the migrations and manifest.

## 3. Defect found and fixed: verification scripts that could silently do nothing

Five scripts decided whether they were being run directly by comparing `process.argv[1]` with `import.meta.url`. Through a symlink (macOS `/var` to `/private/var`) the comparison is false, so the script exited 0 without checking anything. This was found when a deliberate tamper test passed. The check now compares real paths, with a test for the symlink case, mutation-checked.

- Fixed locally in the 007E CI branch (5 scripts + test) and in the 007E docs branch (`draw-review-sample.mjs` + test).
- **The pushed PR branches #85, #90 and #91 still contain the old guard.** Fixing them needs a push approval.

## 4. Provenance of the 58 bootstrap ayahs

Full note: `mobile/docs/review-packets/BOOTSTRAP-58-AYAH-PROVENANCE.md`.

- They come from api.alquran.cloud (`quran-uthmani`), seeded 2026-08-18, but the database credits **Tanzil** for them (backfill migration `20260820140000`).
- Measured: they have 0.03 tatweel per ayah against 1.05 in the Tanzil rows, so they are **not byte-identical to Tanzil** text. Neither the api.quran.com comparison nor the "0 substantive discrepancies" Tanzil check left an artefact, and "substantive" is undefined.
- The Tanzil artefact is not in the repository (only its checksum), so a character-level comparison was not possible without a download.

## 5. Unresolved licensing and attribution questions

1. Credit for the 58 ayahs (api.alquran.cloud text credited to Tanzil; no api.alquran.cloud licence on file).
2. The Tanzil migration `20260820160000` has no copyright or licence line, in a public repository.
3. Whether stripping the Bismillah or splitting it counts as a change under Tanzil's "no changes" condition.
4. Wikisource transcription licence (Kazimirski).
5. Pickthall recorded as public domain for the United States only.
6. The 58 Hamidullah French rows are `disputed` and unused by the app; keep or remove.
7. Quran text sits in a public repository's migrations; redistribution terms need review.

## 6. Review materials

Updated in `mobile/docs/review-packets/`: the Arabic, French and legal packets (addenda), the README, and the new provenance note. Native-speaker review of French and Arabic is still required; none was done.

## 7. CI proposal (local only)

A new `content-full` job in `.github/workflows/mobile-ci.yml` rebuilds the full database on a GitHub runner using Docker, requires both fingerprints to match, runs the unit and Playwright suites with none skipped, and replaces the owner-supplied-database job in the release gate. It uses no secrets or variables. actionlint is clean. **It has not run on GitHub**, so run time, container image pulls, and the 45-minute timeout are unproven. Prettier reports the workflow file as unformatted; the pushed version of that file (`5ad2a0f`) had the same warning, and it was not reformatted.

## 8. Test results

| Check                                                       | Result                                                                                                                                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App unit and Playwright suites on the rebuilt database      | pass (103/103, 225/225)                                                                                                                                                                                   |
| Database verifier on the rebuilt file                       | OK                                                                                                                                                                                                        |
| actionlint, shellcheck on the new CI job and rebuild script | clean                                                                                                                                                                                                     |
| Script tests in the CI worktree                             | 46 passed, 23 skipped; **2 suites failed to load** (`curriculum-export`, `kazimirski-export`: "unable to open database file", the worktree has no database). They passed earlier on the rebuilt database. |
| `draw-review-sample` tests                                  | 7/7, symlink test fails without the fix                                                                                                                                                                   |
| Full-repo ESLint, tsc, iOS and Android device tests         | **not re-run** this phase                                                                                                                                                                                 |
| GitHub CI for the new branches                              | **not run** (not pushed)                                                                                                                                                                                  |

## 9. Housekeeping problem (mine)

While checking a Prettier result I ran `git stash` and `git stash pop` in the CI worktree. The worktree was clean, so the pop applied an older, unrelated stash ("superseded: external-reviewer packet regeneration, cancelled per owner decision") instead. It left three `LEVEL6-*` files modified and one conflicted in `/Users/amkristian/Pictures/recent-update/qr-006-ci`. The stash entry is still intact, and no commit was touched. I tried to reset the worktree but the permission check refused, so I stopped. To clean up, run `git reset --hard HEAD` in that worktree (this discards only the popped changes).

## 10. Ruleset and release facts (unchanged)

"Protect main" requires one approval from a non-author, an up-to-date branch and the `test` check, with no force push; the Admin role can bypass (never used). The production environment requires reviewer Makamou and permits self-review. Production runs 44967138877 and 43080211371 were not approved.

## 11. Decisions needed from you

1. Push the 007E CI branch and the 007E docs branch (and with them the symlink-guard fix for #90 and #91; #85 needs its own).
2. Approve running the `content-full` job on GitHub.
3. Named reviewers (Arabic, French, legal) and a second approver; decide about self-review and Admin bypass.
4. Permission to download the Tanzil artefact for the 58-ayah comparison, and what to do with the credit and the disputed French rows.
5. Native-speaker review; artwork rights; iOS bundle identifier and signing.

## 12. Next milestone: QR-DESIGN-007F

Run `content-full` on GitHub, compare the 58 ayahs with the Tanzil and KFGQPC files, and start the reviewer sessions.
