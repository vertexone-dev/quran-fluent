# PHASE 8B — Automated Content Integrity Enforcement

**Branch:** `feature/phase8b-automated-content-integrity` (based on `origin/main` @ `76647aa`, the PR #16 merge commit). **Not merged. Not deployed.**

**Scope:** Turn the four automation gaps identified in `PHASE8A-CONTENT-INVENTORY.md` §9/§10 into real, CI-enforced checks: unit tests in CI, a read-only content-integrity validator wired into both pipelines, a focused production Quran Reader smoke suite, and the pipeline ordering to run them. No Quran content, Kazimirski mapping, Arabic, or Pickthall data was modified. No database migration was introduced.

---

## 1. What was automated

### 8B.1 — Unit tests in CI
`npm run test:unit` (Vitest) now runs in `ci.yml`, blocking, right after lint.

### 8B.2 — Quran content integrity validation
A new read-only Node script, `scripts/validate-quran-content.mjs`, connects with the same publishable/anon Supabase key the app itself uses (RLS already grants open `SELECT` on every table it reads — confirmed via `pg_policies` during this audit) and runs 20 structural/referential checks, exposed as `npm run validate:quran-content`. It never writes.

### 8B.3 — Production Quran Reader smoke suite
A new Playwright spec, `tests/e2e/51-production-quran-smoke.spec.ts`, adds 4 focused tests covering Arabic, Pickthall, Kazimirski, the Surah 106 compound-boundary case, and Reader stability. It is registered in `playwright.config.ts`'s `authenticated` project (required for `production-validation.yml`'s explicit-file invocation to find it — Playwright project `testMatch` arrays are whitelists, not globs, in this config) but self-guards with `test.skip(!process.env.PLAYWRIGHT_BASE_URL, ...)`, so it is a genuine no-op wherever `PLAYWRIGHT_BASE_URL` isn't set (i.e. `ci.yml`'s full-suite run against local/dev data) and only actually executes where it's set — which in this repo is exclusively `production-validation.yml`, pointed at the real deployed Worker.

### 8B.4 — Pipeline ordering
`ci.yml`: lint → unit tests → content integrity validation → build → E2E (unchanged order otherwise).
`production-validation.yml`: install → **content integrity validation (strict)** → existing learning-path E2E (specs 17–41, unchanged) → **production Quran smoke suite** → artifact uploads.

---

## 2. A genuine environment discrepancy found and handled mid-implementation

While verifying the validator locally I discovered that the database `ci.yml`/local `.env.test` actually reach is **not** production — it is a schema-migration-seeded environment (full canonical Quran + Pickthall, matching `supabase/migrations/`) that never received the Kazimirski corpus, which was applied to production only, out-of-band, via the direct-Postgres adapter built during the earlier migration gate. This matches what `50-kazimirski-french-reader.spec.ts`'s own comment already said ("local dev... still has an unrelated Phase 3 prototype fixture"), confirmed directly: querying that environment's `content_sources` returns `kazimirski-1869` and `kazimirski-1869-segments-phase3`, never the certified `kazimirski-1869-segments-v1`.

This meant a validator that hard-required the Kazimirski corpus everywhere would have made `ci.yml` permanently red the moment it merged — a real risk I caught before it shipped, not after. The fix: the validator treats "no `kazimirski-1869-segments-v1` row" as an **environment note** (logged, not a failure) by default, and only escalates it to a hard failure when the caller sets `REQUIRE_KAZIMIRSKI_SOURCE=true` — which `production-validation.yml`'s invocation does, and `ci.yml`'s does not. Canonical structure, Arabic, and Pickthall checks are unconditional everywhere (verified present in both environments).

## 3. Exact commands

```
npm run test:unit                          # Vitest, 4 files / 37 tests
npm run validate:quran-content              # soft Kazimirski check (dev/CI database)
REQUIRE_KAZIMIRSKI_SOURCE=true npm run validate:quran-content   # strict (production only)
npx playwright test tests/e2e/51-production-quran-smoke.spec.ts # requires PLAYWRIGHT_BASE_URL
```

## 4. CI integration (`.github/workflows/ci.yml`)

Added two steps between `Lint` and `Build`:
```yaml
- name: Unit tests
  run: npm run test:unit

- name: Quran content integrity validation
  run: npm run validate:quran-content
```
Both are blocking (default `run:` failure semantics — no `continue-on-error`). No new secrets required; both reuse the job's existing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` env.

## 5. Production validation integration (`.github/workflows/production-validation.yml`)

Added, after `Install Playwright Chromium`:
```yaml
- name: Quran content integrity validation (strict — Kazimirski corpus required)
  env:
    REQUIRE_KAZIMIRSKI_SOURCE: "true"
  run: npm run validate:quran-content
```
Added, after the existing learning-path E2E step and its artifact uploads:
```yaml
- name: Run production Quran Reader smoke suite (spec 51)
  if: always()
  env:
    PLAYWRIGHT_HTML_REPORT: playwright-report-quran-smoke
  run: npx playwright test tests/e2e/51-production-quran-smoke.spec.ts

- name: Upload Quran smoke suite report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: production-validation-quran-smoke-report
    path: playwright-report-quran-smoke/
    retention-days: 7
```
`if: always()` on the smoke-suite step means it still runs (and can still fail the job) even if the learning-path suite above it already failed — a smoke-suite failure is never silently skipped. It reports to a separate HTML report directory (`PLAYWRIGHT_HTML_REPORT` override) and gets its own artifact, so a failure is attributed clearly to the Quran content gate rather than buried in the 25-spec learning-path run. This workflow is unchanged in every other respect — same triggers (`workflow_dispatch`, `workflow_call` from `production-deploy.yml`), same existing spec list, same existing secrets.

`production-deploy.yml` required no changes: its `validate` job already calls `production-validation.yml` via `uses:` + `secrets: inherit`, so both new steps are automatically part of the post-deploy gate.

## 6. Integrity rules now enforced

| Rule | Where | Environment |
|---|---|---|
| 114 canonical surahs | `validate-quran-content.mjs` | always |
| 6236 canonical ayahs, no duplicates, no gaps, `surahs.ayah_count` matches actual rows | `validate-quran-content.mjs` | always |
| Arabic 6236/6236, no missing/empty text, no null `arabic_source_id` | `validate-quran-content.mjs` | always |
| Pickthall: exactly one source, 6236/6236, no missing/empty/duplicate rows | `validate-quran-content.mjs` | always |
| Kazimirski: exactly one source, 6239 segments / 6396 joins (certified totals), 6236/6236 canonical coverage, 0 orphan segments, 0 dangling mappings, 0 duplicate joins, valid enum domains, `source_ordinal` non-negative and unique per surah, every multi-ayah segment carries a non-`direct` `alignment_type` (architectural invariant, not a hardcoded ratio) | `validate-quran-content.mjs` (`REQUIRE_KAZIMIRSKI_SOURCE=true`) | production only (`production-validation.yml`) |
| Arabic renders with `dir="rtl"`/`lang="ar"`; Pickthall attribution correct; Al-Fatiha = 7 cards | `51-production-quran-smoke.spec.ts` | production only |
| Kazimirski attribution correct, never Hamidullah, no unavailable/null fallback | `51-production-quran-smoke.spec.ts` | production only |
| Quraish = 4 cards; compound-boundary segment renders once on ayah 3, never duplicated onto ayah 4 (data-driven from the live join table, not a hardcoded fixture) | `51-production-quran-smoke.spec.ts` | production only |
| No console errors, no failed critical network requests, no horizontal overflow at 390×844, stable across navigation/reload | `51-production-quran-smoke.spec.ts` | production only |
| Vitest suite (including `kazimirski.test.ts`'s "home ayah" algorithm coverage) | `ci.yml` | every PR/push to main |

Historical-numbering divergence (multi-segment ayahs, multi-ayah segments) is explicitly **not** a failure condition anywhere — the validator logs the counts as `INFO` and only asserts the architectural invariant that any multiplicity is labeled by a non-`direct` `alignment_type`, never a specific ratio or count.

## 7. Remaining manual checks

- The 21-point Python validators (`validate_kazimirski_import.py`, `production_validator_direct.py`) remain unwired from CI — the new Node validator supersedes their CI role but the Python scripts themselves were left untouched, per the standing instruction against unrelated changes.
- Content-quality/translation-accuracy review (as opposed to structural/referential integrity) remains manual — outside this phase's scope, matching Phase 8A's finding that `kazimirski-1869-segments-v1`'s `verification_status` is deliberately `candidate`, not `verified`.
- The two Phase 8A "requires human review" items (legacy_interim `kazimirski-1869` source row; canonical Arabic's `candidate` status) were left untouched, as instructed.
- `test-results/` (raw failure artifacts) is only guaranteed captured for the learning-path suite's own failures, not the smoke suite's, since both `npx playwright test` invocations share that output directory and only one `if: failure()` upload step exists ahead of the smoke suite. The smoke suite's own HTML report is always uploaded regardless, which is sufficient for triage; a shared `test-results` capture for both suites was judged unnecessary complexity for a two-report pipeline.

## 8. Test results (this session, local)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (14 pre-existing warnings, unrelated to this change) |
| `npm run test:unit` | 37/37 passed (4 files) |
| `npm run build` | succeeds |
| `npm run validate:quran-content` (local/CI-equivalent DB) | 11/11 passed, Kazimirski checks correctly skipped with an explanatory INFO line |
| `REQUIRE_KAZIMIRSKI_SOURCE=true npm run validate:quran-content` (local/CI-equivalent DB) | 11/12 passed, 1 expected failure ("Kazimirski row exists") — proves the strict flag actually escalates |
| `REQUIRE_KAZIMIRSKI_SOURCE=true npm run validate:quran-content` (real production, read-only, via a temporary local credential file deleted immediately after) | **27/27 passed** — exactly matches Phase 8A's audited figures (6239 segments, 6396 joins, 150/152 informational multi-mapping counts) |
| Full local E2E run, specs 50 + 51 (`npx playwright test tests/e2e/50-... tests/e2e/51-...`) | 34 passed, 4 skipped (spec 51's 4 tests correctly self-skip against local dev) |
| Spec 51's unauthenticated assertions, verified directly against the real live production Reader (`https://quranroots.vertexone.workers.dev`, read-only, no login, no writes) | Al-Fatiha: 7 cards ✓ · Arabic `dir="rtl"`/`lang="ar"` visible with real text ✓ · Pickthall attribution button visible ✓ · Quraish: 4 cards ✓ |
| `tsc --noEmit` | 5 pre-existing errors in `src/lib/curriculum.test.ts`, confirmed present on `origin/main` before this branch (unrelated to this change, not introduced by it) |

Spec 51's two authenticated tests (Kazimirski attribution/fallback, and the Surah 106 compound-boundary check) were **not** run live against production in this session — that requires the real production `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`, which exist only as GitHub Actions secrets and would mutate the shared production test account's profile outside the approved, approval-gated pipeline. These were instead verified by code review against the same selector/attribution/"home ayah" patterns already proven correct in `50-kazimirski-french-reader.spec.ts` and `15-full-dataset.spec.ts`, plus the unauthenticated verification above confirming the underlying DOM structure the tests query against is exactly as expected on the real deployed page.

## 9. Risks / unresolved issues

- Spec 51's two authenticated tests are unverified against real production until the pipeline itself runs them (see §8). This is expected — running them for real requires the actual CI run, which this task explicitly does not authorize.
- `test-results/` artifact-sharing limitation noted in §7.
- If the Kazimirski certified corpus is ever legitimately re-certified with different totals, `EXPECTED_KAZIMIRSKI_SEGMENTS`/`EXPECTED_KAZIMIRSKI_JOINS` in `scripts/validate-quran-content.mjs` need updating alongside it (documented in the script itself).
- No database migration was introduced or judged necessary for this phase.

## 10. Files changed

- `.github/workflows/ci.yml` — added Unit tests + Quran content integrity validation steps.
- `.github/workflows/production-validation.yml` — added strict content integrity validation step, production Quran smoke suite step + its own artifact upload.
- `package.json` — added `validate:quran-content` script.
- `playwright.config.ts` — registered `51-production-quran-smoke.spec.ts` in the `authenticated` project's `testMatch`.
- `scripts/validate-quran-content.mjs` — new.
- `tests/e2e/51-production-quran-smoke.spec.ts` — new.

No other files were modified. No Quran content, Kazimirski mapping, Arabic, Pickthall, Hamidullah-remediation, or GitHub/Cloudflare configuration was touched.
