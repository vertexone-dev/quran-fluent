# Supplying the approved Quran database to CI: options and recommendation

QR-DESIGN-007C, Phase 5. **Design and comparison only. Nothing here is implemented, enabled or activated. No database was read, exported, copied or modified to write it.** Selecting and building a mechanism needs project-owner approval.

This supersedes the shorter option table in `mobile/CONTENT-DB-CI.md` (QR-DESIGN-006, on the unmerged fail-closed CI branch), whose recommendation (option D) is revisited below because it reads production.

## 1. The problem

The mobile content tests and the release gate need `mobile/public/quran-content.sqlite`. CI cannot have it today, so the DB-backed checks do not run there and the fail-closed release gate is red on pushes to `main` by design.

Facts that constrain every option (all verified in the repository, none by touching the database):

| Fact                                                                                                                                                                                                                                                                                                                         | Consequence                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| The file is gitignored, WAL-mode, and embeds `generated_at`: **not byte-reproducible**.                                                                                                                                                                                                                                      | Compare **content**, never the file hash, across builds.                                                                         |
| `content_version.overall_sha256` (the _content fingerprint_) is a deterministic hash over the sorted Arabic ayahs, English rows, Kazimirski segments and mappings. `verify-content-db.mjs` recomputes it; `content-db.expected.json` pins the approved value (`b586ba39…`) and counts (114 / 6,236 / 6,236 / 6,239 / 6,396). | A rebuilt database is acceptable **iff** its recomputed fingerprint equals the pinned one. This is the one non-negotiable check. |
| The repository is **public**. Fork PRs get no secrets or variables.                                                                                                                                                                                                                                                          | Anything committed, attached or logged is public. Secrets cannot protect anything on fork PRs.                                   |
| The only generator, `mobile/scripts/export-content-db.mjs`, reads **production Supabase** with the publishable key, and **refuses** to run against a local stack (a deliberate guard).                                                                                                                                       | Any option using it touches production and needs approval.                                                                       |
| Sources: Tanzil Uthmani 1.1 (CC BY 3.0, verbatim copies allowed, no changes), Pickthall (public domain), Kazimirski via Wikisource (public domain; transcription licence needs legal review).                                                                                                                                | Republishing the bundled text is a rights question, not just a technical one.                                                    |

## 2. Requirements for this phase

Do not access production. Do not modify the approved database. Do not upload restricted database content. Do not disable fingerprint validation. Do not weaken fail-closed checks. Do not add secrets to Git history.

## 3. Options compared

|                                        | A. Commit the DB or attach it to a release | B. Encrypted DB committed, key in an Actions secret                        | C. Private object storage behind a token | D. Owner-triggered job re-exports from production (read-only, publishable key) | **E. Rebuild in CI from repo-pinned sources into a disposable local database** | F. Owner-attested release (no DB in CI) |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------- |
| Touches production                     | no                                         | no                                                                         | no                                       | **yes** (read-only)                                                            | no                                                                             | no                                      |
| Publishes the DB or restricted content | **yes** (public repo)                      | ciphertext forever in history                                              | no                                       | no                                                                             | no                                                                             | no                                      |
| Secrets needed                         | none                                       | **yes** (cannot protect fork PRs; rotation does not remove old ciphertext) | **yes** (token)                          | none new (publishable key already public)                                      | none                                                                           | none                                    |
| New service or cost                    | none                                       | none                                                                       | **new service, cost**                    | none                                                                           | none                                                                           | none                                    |
| Fingerprint check kept fail-closed     | yes                                        | yes                                                                        | yes                                      | yes                                                                            | yes                                                                            | **no** (CI cannot see the DB)           |
| Works on fork PRs                      | yes                                        | no                                                                         | no                                       | no (owner-triggered only)                                                      | **yes**                                                                        | yes                                     |
| Reproducible and auditable             | file only                                  | file only                                                                  | file only                                | content-level                                                                  | **content-level, from public inputs**                                          | no                                      |
| Third-party availability risk          | none                                       | none                                                                       | storage vendor                           | production uptime                                                              | **source sites (Tanzil, Wikisource, Gutenberg)**                               | none                                    |
| Effort                                 | small                                      | small                                                                      | medium                                   | small                                                                          | **medium to large, with a spike**                                              | small                                   |
| Meets every requirement in section 2   | **no** (publishes)                         | **no** (history, secret)                                                   | **no** (service/cost without approval)   | **no** (production access)                                                     | **yes, if the spike succeeds**                                                 | **partly** (weakens the gate)           |

## 4. Recommendation

**Primary: option E, gated by a time-boxed spike.** It is the only option that meets all five requirements and also works for fork PRs. It treats the database as a **build product of public, hash-pinned inputs** instead of a file to distribute, and it keeps the fingerprint check exactly as strict as today.

**Interim: option F**, which costs nothing and changes nothing in CI. Until E is proven, the owner builds release artifacts from the approved file locally and runs `npm run release:check` plus `verify-content-db.mjs`, and the fail-closed gate stays red on `main` rather than being relaxed. (Do not "fix" the red gate by skipping the content job; that is exactly the weakening this phase forbids.)

**Fallback: option D**, only if the spike fails, and only with explicit owner approval to read production read-only from CI for this single purpose. It is the earlier 006 recommendation; it is demoted because it needs production access and because E needs none.

Options A, B and C are not recommended: A publishes, B leaves ciphertext in history and cannot protect forks, C adds a service and a cost.

## 5. How E would work (design)

1. The workflow starts a **disposable local Supabase stack** inside the runner (the repository already does this for e2e: `.env.test` and `npm run test:e2e:setup`). It is created for the job and destroyed with it. It is not the owner's long-running local stack and not production.
2. Apply the repository's own migrations (Arabic import `20260820160000`, Pickthall import and promotion `20260820170000–190000`, the source-governance rows). These are already public in the repo.
3. Fetch the **pinned third-party artifacts** and check each against the SHA-256 the repository already records: Tanzil text `6933e133…`, Tanzil metadata `8867c1d8…`, Pickthall Gutenberg file `8ea8efcd…`, Kazimirski Wikisource artifact `38f94de9…`. A mismatch fails the job.
4. Load the Kazimirski segments and mappings from the repo-committed, human-reviewed artifacts (`scripts/quran-import/kazimirski/`, including `PHASE5-REVIEW-DECISIONS.json`) using the existing import tooling.
5. Run the exporter against the **disposable** stack (needs a narrowly scoped, explicit `--target=local-ci` flag; the production-safety guard stays the default and is not removed).
6. Run `verify-content-db.mjs` with `REQUIRE_CONTENT_DB=1`. It recomputes the content fingerprint and fails unless it equals `content-db.expected.json`. Then the existing unit, Playwright, artwork-guard and `assert-no-skips` steps run unchanged.
7. The file never leaves the runner: no upload, no artifact, no cache. Nothing is committed.

Security properties: no secrets, no production access, no publication, same fail-closed fingerprint check, works for forks, and the only network inputs are public sources whose hashes are pinned.

## 6. What is unproven (why a spike comes first)

These are open questions, not findings:

- **Fingerprint equality.** Nobody has shown that rebuilding from the repo reproduces `b586ba39…`. The approved file was exported from production, which may carry data or ordering produced by steps that are not in the migrations. The spike's pass/fail criterion is exactly this equality (plus the five counts).
- **Kazimirski loading.** Segments were imported with a Postgres adapter and reviewed decisions, not a plain migration. The local rehearsal report (`PRODUCTION-LOCAL-REHEARSAL-REPORT.md`) suggests it is repeatable, but not that it runs unattended in CI.
- **Source availability and terms.** Tanzil's download flow and Wikisource page stability are outside our control. Pin by hash and by Wikisource revision id (the revision id is not recorded today).
- **Exporter guard.** Adding a local target must not weaken the default production guard.
- **Run time and size** on a GitHub-hosted runner.

**Spike plan (separate approval, isolated, reversible):** build the database locally from the repo on a separate port, run the verifier, and report equal / not equal and every difference. Success is equality of the fingerprint and counts. Failure ends option E and leaves D as the approved fallback. No production access, no change to the approved file, no CI change until the owner approves the result.

## 7. Decisions needed from the owner

1. Approve the spike for option E (isolated, local, no production access), or choose another option.
2. Keep option F as the interim and accept the red release gate on `main` until E or D is in place.
3. Only if E fails: approve read-only production access from CI for option D, for this single purpose.
4. Enable branch protection on `main` and require the "mobile release gate" check (owner action; not changed by this work).
