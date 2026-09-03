# PHASE 8A — Content Inventory

**Scope:** Read-only audit of canonical Quran structure, Arabic text, Pickthall translation, and Kazimirski translation data in **production** (Supabase project `wubzdnuwrhmrodwqkicg`), plus mapping-integrity, ordering/numbering, attribution/metadata, and existing automated coverage.

**Method:** Every figure below was obtained by direct read-only SQL against production (`mcp__claude_ai_Supabase__execute_sql`) executed during this audit, or by direct inspection of the repository's current migration DDL / import / validation / test / CI code. No database record, migration, translation mapping, GitHub configuration, Cloudflare configuration, or production state was modified. No file other than this report was created or changed.

**Date of audit:** 2026-09-02.

---

## 1. Executive summary

Production content is **structurally sound and internally consistent**. Canonical Quran structure (114 surahs, 6236 ayahs), Arabic text, and Pickthall translation are 100% complete with zero integrity violations found. The Kazimirski French translation corpus (certified in the prior migration gate) remains at its certified state — 6239 segments, 6396 joins, 6236/6236 canonical ayah coverage, 0 orphans, 0 dangling mappings — and is unchanged since that certification.

**No confirmed integrity violations were found in this audit.**

Two items require review, both classified as **historical/source-numbering divergence** (expected-by-design, not defects):
- 150 canonical ayahs are covered by 2+ Kazimirski segments (`many_to_one` / `compound` alignment).
- 152 Kazimirski segments span 2+ canonical ayahs (`one_to_many` / `compound` alignment).

Both are direct, already-understood consequences of Kazimirski's own 1869 numbering differing from the canonical Uthmani ayah numbering — this is the exact condition the segment/join schema (`translation_segments` / `translation_segment_ayahs`) was designed to represent, and every one of these rows already carries an explicit `alignment_type` value describing which of the four non-`direct` shapes it is. See §5 and §11 for the full breakdown; none are flagged as errors.

The most significant finding of this audit is **not** a data-integrity problem but a **coverage gap in automated protection** (§9): the Kazimirski/Quran-reader-specific automated tests exist and pass, but (a) the Python production validators (`validate_kazimirski_import.py`, `production_validator_direct.py`) are one-off scripts never wired into any CI workflow, and (b) the Vitest unit-test suite (`npm run test:unit`, including `kazimirski.test.ts`'s 13 tests) is never invoked by any GitHub Actions workflow at all. Content correctness today rests on the one-time certification performed during the migration gate plus the general E2E suite, not on continuous automated re-verification of the underlying data. Full detail in §7 and §9.

---

## 2. Canonical Quran inventory

| Check | Result |
|---|---|
| Surah count | **114** |
| Ayah count | **6236** |
| Surahs where `ayah_count` metadata mismatches actual `ayahs` rows | **0** |
| Duplicate `(surah_number, ayah_number)` rows | **0** |
| Ayah-number gaps within any surah (non-contiguous 1..N) | **0** |

Enforced live by DB constraints: `ayahs_pkey` (PK), `ayahs_surah_number_ayah_number_key` (UNIQUE on `(surah_number, ayah_number)`), `ayahs_ayah_number_check` (`ayah_number > 0`), `ayahs_surah_number_fkey` (FK → `surahs(number)`, `ON DELETE CASCADE`).

## 3. Arabic coverage

| Check | Result |
|---|---|
| Ayahs with non-empty `arabic_text` | **6236 / 6236** |
| Missing / NULL / empty-string `arabic_text` | **0** |
| Ayahs with NULL `arabic_source_id` | **0** |

100% coverage, no gaps.

## 4. Pickthall coverage

| Check | Result |
|---|---|
| Source | `content_sources.id = f32639a6-8dc1-4be0-b8fc-bc9ac1c0fb76`, `edition_identifier = pickthall-gutenberg-16955`, translator "Marmaduke Pickthall", `verification_status = verified`, license "Public Domain (United States)" |
| Rows | **6236 / 6236** |
| Missing / NULL / empty text | **0** |
| Duplicate `(surah_number, ayah_number)` rows for this source | **0** |
| Rows referencing a nonexistent ayah | **0** |

100% coverage, no gaps, single verified source.

## 5. Kazimirski coverage

| Check | Result |
|---|---|
| Source | `content_sources.id = f8443b10-3cc8-59ee-954f-5b1129c1cec4`, `edition_identifier = kazimirski-1869-segments-v1`, translator "Albin de Kazimirski Biberstein", version "Charpentier, Paris, 1869 printing (translation first published 1840)", `verification_status = candidate`, license "Public domain" |
| Segments | **6239** (6238 `numbered` + 1 `unnumbered_preamble`) |
| Segment↔ayah joins | **6396** |
| Distinct canonical ayahs covered | **6236 / 6236** (0 missing) |
| Orphaned segments (segment with 0 joins) | **0** |
| Dangling joins (join → nonexistent ayah) | **0** |
| Duplicate joins (same `segment_id, surah_number, ayah_number`) | **0** |
| Ayahs covered by 2+ segments | **150** (expected `many_to_one` / `compound`) |
| Segments spanning 2+ ayahs | **152** (expected `one_to_many` / `compound`) |

`alignment_type` breakdown (6239 total): `direct` 2909, `offset` 2877, `many_to_one` 291, `one_to_many` 144, `compound` 17, `source_anomaly` 1.

`alignment_status` breakdown (6239 total): `auto_verified` 5742, `cross_verified` 440, `human_verified` 57.

`mapping_confidence` breakdown (6396 total): `auto` 5839, `cross_verified` 477, `human_verified` 80.

This is byte-for-byte consistent with the corpus certified PASS during the earlier production-migration gate (`PRODUCTION-IMPORT-EXECUTION-REPORT.md`) — no drift since certification.

## 6. Mapping-integrity results

| Check | Result | Classification |
|---|---|---|
| Segments with zero ayah joins | 0 | n/a (clean) |
| Joins referencing a nonexistent `(surah_number, ayah_number)` | 0 | n/a (clean) |
| Duplicate joins | 0 | n/a (clean) |
| Ayahs with no Kazimirski coverage at all | 0 | n/a (clean) |
| Ayahs with 2+ segments (`many_to_one`/`compound`) | 150 | **historical/source-numbering divergence** — Kazimirski's 1869 verse numbering does not always align 1:1 with canonical Uthmani numbering; these are legitimate multi-segment ayahs, not errors |
| Segments spanning 2+ ayahs (`one_to_many`/`compound`) | 152 | **historical/source-numbering divergence** — same root cause, reverse direction |
| Segments with `alignment_type = source_anomaly` | 1 | **historical/source-numbering divergence** — already flagged as such by the import's own classification; not a new finding |
| Segments with `alignment_status = unresolved` | 0 | n/a (clean; all segments reached a resolved status) |

No confirmed integrity violations. No probable content issues. All non-`direct` alignment cases were already explicitly modeled and labeled at import time — this audit confirms the labels are internally consistent (breakdown sums match total row counts; §5) rather than surfacing anything new.

## 7. Ordering/numbering results

| Check | Result |
|---|---|
| Duplicate ordinals within a surah | 0 |
| Ordinal-range gaps within a surah (non-contiguous) | 0 |
| Rows with NULL `source_declared_number` | **3**, all previously reviewed: Surah 1 ordinal 0 (Bismillah preamble, `unnumbered_preamble`), Surah 2 ordinal 286, Surah 36 ordinal 83 (the two deliberate NULLs reviewed in the prior Phase-5 gate) |
| Non-monotonic `source_declared_number` sequences within any surah | 0 |

No new numbering anomalies found; the 3 known NULLs match the previously-documented and reviewed set exactly.

## 8. Attribution/source metadata

Live enumeration of all 5 `content_sources` rows in production:

| `edition_identifier` | translator | `verification_status` | notes |
|---|---|---|---|
| `uthmani` | NULL | `candidate` | canonical Arabic (`arabic_text`, language `ar`), license "Creative Commons Attribution 3.0" |
| `pickthall-gutenberg-16955` | Marmaduke Pickthall | `verified` | license "Public Domain (United States)" |
| `kazimirski-1869-segments-v1` | Albin de Kazimirski Biberstein | `candidate` | the certified segment corpus; `source_url` = Wikisource page; `retrieved_at` 2026-09-01 14:50:33 UTC; `public_domain = true`, `legacy_interim = false` |
| `kazimirski-1869` | Albin de Kazimirski Biberstein | `candidate` | separate, pre-existing **legacy_interim** row — not the row backing today's French reader (see §9 Unprotected risks) |
| `fr.hamidullah-crf` | Muhammad Hamidullah | `disputed` | explicitly out of scope per standing instruction; not touched |

**Notable, non-anomalous observation:** canonical Arabic's own backing source (`uthmani`) carries `verification_status = candidate`, the same status as Kazimirski, despite being treated throughout this engagement as the authoritative reference text. This is pre-existing and outside this audit's mandate to alter — flagged here only as a fact for Phase 8B to consider, not as an integrity violation (the Arabic text itself is 100% complete and internally consistent per §3).

## 9. Existing automated protections

**Database-level (always-on, enforced on every write):**
- `ayahs`: PK, `UNIQUE(surah_number, ayah_number)`, `ayah_number > 0`, FK to `surahs`.
- `translations`: PK, `UNIQUE(surah_number, ayah_number, source_id)`, `btrim(text) <> ''`, FK to `content_sources`, FK to `ayahs`.
- `translation_segments`: PK, `UNIQUE(source_id, surah_number, source_ordinal)`, `segment_type IN ('numbered','unnumbered_preamble')`, `alignment_type IN (direct, offset, one_to_many, many_to_one, compound, unresolved, source_anomaly)`, `alignment_status IN (auto_verified, cross_verified, human_verified, unresolved, rejected)`, `source_declared_number IS NULL OR > 0`, `source_ordinal >= 0`, `btrim(text) <> ''`, `text_sha256 ~ '^[0-9a-f]{64}$'`, FK to `surahs`, FK to `content_sources`.
- `translation_segment_ayahs`: PK, `UNIQUE(segment_id, surah_number, ayah_number)`, `mapping_confidence IN (auto, cross_verified, human_verified, needs_review)`, FK to `translation_segments` (`ON DELETE RESTRICT`), FK to `ayahs` (`ON DELETE RESTRICT`).

These constraints permanently prevent: empty text, malformed hashes, out-of-domain enum values, duplicate mappings, and orphaned foreign keys — regardless of which tool writes to the table.

**Import/validation-time (run once, manually, during the migration):**
- `import_production_kazimirski.py` / `run_kazimirski_production_execution.py` — the transactional importer used for the certified migration.
- `validate_kazimirski_import.py` and its direct-Postgres port `production_validator_direct.py` — 21-point validators (source count, segment/join counts, coverage, unresolved count, all three enum breakdowns, human-verified counts, Tier-2 boundary joins, aggregate content hash, canonical Arabic/Pickthall baseline hash, unexpected/missing row diffs by deterministic ID) that were run against production during the migration gate and passed. **These are standalone scripts, not wired into any CI workflow** (`grep` across `.github/workflows/*.yml` for any reference to them returns nothing) — they only run when a human invokes them manually.

**Application-level automated tests:**
- `src/lib/kazimirski.test.ts` — 13 Vitest unit tests covering the "home ayah" render algorithm, all `alignment_type` shapes, the Surah 106 compound-boundary regression, and disputed-source exclusion. **`npm run test:unit` (Vitest) is not invoked by `ci.yml`, `production-deploy.yml`, or `production-validation.yml` — it does not run in any automated pipeline today.**
- `tests/e2e/06-quran-reader.spec.ts`, `14-translation-fallback.spec.ts`, `15-full-dataset.spec.ts`, `49-french-translation-remediation.spec.ts`, `50-kazimirski-french-reader.spec.ts` — Playwright E2E specs covering the Quran reader, translation fallback behavior, full-dataset assertions, and the Kazimirski French reader (Al-Fatiha, Surah 106). These run as part of the **full** suite (`npm run test:e2e`, all specs) in `ci.yml` on every push/PR to `main`, against a **local dev database**, not production.
- `production-validation.yml` runs a **curated subset** of specs (17–35, 37–41 — the lesson/curriculum/learning-path suite) against real production, both standalone and as a stage of `production-deploy.yml`. **None of specs 06, 14, 15, 49, or 50 are in that subset** — the Quran-reader/Kazimirski-specific E2E tests never run against production automatically; they only ever run against local dev data in `ci.yml`.

## 10. Unprotected risks

1. **No CI-wired re-verification of Kazimirski content integrity against production.** The 21-point validators that certified the migration are one-off scripts. If production Kazimirski data were ever altered outside the certified import path, nothing in the current pipelines would automatically detect it.
2. **Vitest unit tests never run automatically.** `kazimirski.test.ts` (and all other `*.test.ts` files) exist and pass locally but are not part of `ci.yml`, so a regression in the "home ayah" render algorithm or alignment-shape handling would not be caught by CI — only by whichever E2E specs happen to exercise the affected surah/ayah, or by a human running `npm run test:unit` manually.
3. **Reader-specific E2E specs (06, 14, 15, 49, 50) never run against production**, only against local dev in `ci.yml`. Production-only data differences (as already happened once — see the Surah 106 duplicate-rendering bug found via real production data during Phase C of this engagement) would not be caught by `production-validation.yml`'s curated subset.
4. **Two Kazimirski-attributed `content_sources` rows coexist** (`kazimirski-1869-segments-v1`, `candidate`, the active one; `kazimirski-1869`, `candidate`, `legacy_interim`). The app's resolver (`resolveApprovedFrenchSource()`) filters correctly by `edition_identifier`, but nothing in the schema itself prevents a future writer from accidentally querying/joining against the wrong one by translator name alone.
5. **Canonical Arabic's source (`uthmani`) is `verification_status = candidate`**, not `verified` — same status tier as an unreviewed translation. Not a defect (content is complete/consistent), but worth Phase 8B considering whether canonical text should carry a distinct status tier from translation candidates.

## 11. Exact anomalies requiring review

| # | Anomaly | Evidence | Classification |
|---|---|---|---|
| 1 | 150 canonical ayahs mapped from 2+ Kazimirski segments | `alignment_type IN ('many_to_one','compound')` counts: 291 + 17 segments involved; §5, §6 | **historical/source-numbering divergence** — expected, already labeled at import time |
| 2 | 152 Kazimirski segments mapped to 2+ canonical ayahs | `alignment_type IN ('one_to_many','compound')` counts: 144 + 17 segments; §5, §6 | **historical/source-numbering divergence** — expected, already labeled at import time |
| 3 | 1 segment with `alignment_type = source_anomaly` | §5 breakdown | **historical/source-numbering divergence** — pre-existing, already classified by the import pipeline itself |
| 4 | 3 rows with NULL `source_declared_number` | Surah 1 ordinal 0, Surah 2 ordinal 286, Surah 36 ordinal 83 | **historical/source-numbering divergence** — previously reviewed in the Phase-5 gate, unchanged |
| 5 | Two coexisting Kazimirski `content_sources` rows (active + legacy_interim) | §8, §10.4 | **requires human review** — not an integrity violation (the app correctly uses only the active one), but worth a deliberate decision on whether the legacy_interim row should be archived/removed in a future phase |
| 6 | Canonical Arabic source `verification_status = candidate` | §8, §10.5 | **requires human review** — status-taxonomy question, not a content defect |

No items are classified as **confirmed integrity violation** or **probable content issue**.

## 12. Recommended Phase 8B work

1. Wire `npm run test:unit` into `ci.yml` so the Vitest suite (including `kazimirski.test.ts`) runs on every push/PR, closing the gap in §10.2.
2. Add the Kazimirski/Quran-reader specs (06, 14, 15, 49, 50) to the curated subset in `production-validation.yml`, or establish a separate scheduled/periodic job that re-runs `validate_kazimirski_import.py`'s check set (via `production_validator_direct.py`) against live production, closing the gaps in §10.1 and §10.3.
3. Decide, as a deliberate human review item (not an automated fix), what to do with the legacy_interim `kazimirski-1869` `content_sources` row (§10.4/§11.5) — archive, delete, or document its retained purpose.
4. Decide whether canonical Arabic's `uthmani` source should be promoted to `verified` status or otherwise distinguished from translation-candidate sources (§10.5/§11.6).
5. No remediation is needed for the `many_to_one`/`one_to_many`/`compound`/`source_anomaly` alignment cases (§11 items 1–4) — these are correctly modeled already; Phase 8B should treat them as reference examples of expected behavior, not as a backlog.
