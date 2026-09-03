# PHASE 8C — Content Source Governance Adjudication

**Type:** Read-only investigation and adjudication (§1–§13), followed by
**Phase 8C.2** migration-preparation (§14). No production, CI or local database
was modified in either part. No migration has been applied anywhere. No
`verification_status` was changed in any database. No Kazimirski segment/mapping,
Arabic, Pickthall or French text was touched. No deployment. The Phase 8C.2 PR is
prepared but not merged.

**Date:** 2026-09-03
**Phase 8C (adjudication) branch:** `analysis/phase8c-content-source-governance`
(based on `origin/main` @ `365545f`)
**Phase 8C.2 (fix preparation) branch:** `feature/phase8c-legacy-source-governance`
(based on `origin/main` @ `365545f`)
**Production project:** Supabase project id as recorded in the committed
`supabase/config.toml` (no credentials or connection strings are reproduced in
this document).

> **Phase 8C.2 status (see §14):** the human decision to deprecate the empty
> legacy `kazimirski-1869` source is **approved**. A guarded, idempotent,
> one-row metadata migration
> (`supabase/migrations/20260913100000_7872f932-bfd3-42d6-b36c-36e4b8587c81.sql`)
> and its disposable-database test harness are prepared for PR review. **Nothing
> has been applied to any database.** Canonical Arabic (`uthmani`) remains
> `candidate`; its cross-verification is deferred to Phase 8D.

---

## 1. Executive summary

Two Phase 8A "requires human review" items were investigated with read-only
production evidence:

1. **Legacy `kazimirski-1869` `content_sources` row coexists with the active
   certified `kazimirski-1869-segments-v1`.**
   Finding: the legacy row is **referenced by nothing** — 0 rows in every content
   table, 0 references in application code, tests or fixtures, comment-only mentions
   in two files. It is `legacy_interim = true` but still `verification_status =
   'candidate'` (same tier as the live source). The application resolver pins the
   active source by exact `edition_identifier` + `translator`, so the legacy row
   **cannot** be selected today.
   Recommendation: **mark it `deprecated`** via a future minimal reviewed migration
   (keep the row; preserve provenance). Do **not** physically delete. Alternative
   acceptable outcome: keep unchanged. Human governance sign-off required on which.

2. **Canonical Arabic (`uthmani`) is `verification_status = 'candidate'`.**
   Finding: the Arabic corpus is 6236/6236 structurally complete and internally
   consistent, but its textual authenticity is anchored **only** to the Tanzil
   Uthmani v1.1 artifact plus a 58-ayah spot cross-check against a second
   digitization. The remaining 6178 ayahs have **not** been independently compared
   against an authoritative reference. The artifact SHA-256 is recorded only in a
   migration file comment — not in the DB, not per-row, not as an aggregate.
   Recommendation: **keep `candidate` — do not promote now.** "6236 rows, no gaps"
   proves structural completeness, not textual authenticity, and does not meet this
   project's working bar for `verified` (independent cross-comparison, as done for
   Pickthall). Promotion requires an external authoritative comparison (identified
   in §6) that this phase is not authorized to run.

**Overall result: `HUMAN REVIEW REQUIRED`.**
Neither item has a safe fully-automated resolution: Q1 needs a governance decision
(deprecate vs. keep); Q2 needs human-led external verification before any change.

**Strict validator baseline (read-only, production, `REQUIRE_KAZIMIRSKI_SOURCE=true`):
27 / 27 checks passed, 0 failed.** Re-confirmed at the start of this phase.

---

## 2. Production baseline

| Item | Result |
|---|---|
| `git fetch origin` | `76647aa..365545f  main -> origin/main` |
| Merge commit `365545fdc8b0d087b21cd4c01ba8cf34b88ef1af` in `origin/main` history | **Yes** — it is the tip of `origin/main` (`365545f`, "ci: add automated Quran content-integrity release gates (#17)") |
| Worktree | No tracked modifications. 4 pre-existing untracked paths only: `PHASE8A-CONTENT-INVENTORY.md`, `scripts/quran-import/KAZIMIRSKI-RESEARCH.md`, `supabase/.branches/`, `tests/e2e/36-level2-release-audit-journey.spec.ts` |
| `PHASE8A-CONTENT-INVENTORY.md` | **Untracked** — the Phase 8A inventory was never committed to the repo; it exists only in this working tree. (`PHASE8B-AUTOMATED-INTEGRITY.md` **is** committed, in `703ffa5`, and is on `main`.) |
| Strict content-integrity validator vs production | `node scripts/validate-quran-content.mjs` with `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` from `.env` (production, publishable/anon key — RLS SELECT-only) and `REQUIRE_KAZIMIRSKI_SOURCE=true` → **27/27 passed**. INFO lines: 150 ayahs covered by 2+ Kazimirski segments; 152 Kazimirski segments spanning 2+ ayahs (both expected historical-numbering divergence, not failures). |

Canonical content totals confirmed live: 114 surahs, 6236 ayahs, 6236 Arabic
(`arabic_text` non-empty, 0 NULL `arabic_source_id`), 6236 Pickthall translations,
6239 Kazimirski segments / 6396 segment–ayah joins, 6236/6236 Kazimirski canonical
coverage.

**Reviewed for this adjudication:** `PHASE8A-CONTENT-INVENTORY.md`;
`PHASE8B-AUTOMATED-INTEGRITY.md`; `scripts/validate-quran-content.mjs`;
migrations `20260818042151` (bootstrap), `20260820100000` (source governance schema +
3 provenance rows), `20260820110000` (Tanzil license label fix), `20260820130000` /
`20260820150000` (nullable-column prep), `20260820140000` (bootstrap provenance
backfill), `20260820160000` (full Arabic import, Tanzil v1.1), `20260820170000` /
`20260820180000` / `20260820190000` (Pickthall identity update / import / promote to
`verified`), `20260909100000` (normalized i18n `*_translations` tables),
`20260911110000` (fr.hamidullah-crf disputed-source remediation), `20260912100000`
(Kazimirski segment schema + `kazimirski-1869-segments-v1` registration);
`scripts/quran-import/generate-arabic-migration.mjs`, `validate-tanzil.mjs`,
`generate-pickthall-migration.mjs`; `scripts/quran-import/KAZIMIRSKI-RESEARCH.md`
(Phase 2C-A deferred research, untracked); `scripts/quran-import/kazimirski/`
(PRODUCTION-MIGRATION-IMPORT-DESIGN.md, import/rollback scripts, staged migration
copy); `src/lib/kazimirski.ts`, `src/lib/translations.ts`, `src/lib/quran.ts`;
`tests/e2e/15,49,50,51` and `src/lib/kazimirski.test.ts`.

---

## 3. Complete source inventory

Live read-only enumeration of **all 5** `content_sources` rows in production. There
is **no** `kazimirski-1869-segments-phase3` row in production — that prototype row
exists only in the local/CI-dev database (confirmed by Phase 8B §2 and by the
`20260912100000` precondition comment).

| # | `edition_identifier` | `id` | `language` | `content_type` | `translator` | `version` | `verification_status` | `legacy_interim` | `public_domain` | `created_at` (UTC) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `uthmani` | `5fe9ddf8-bc18-4326-899d-a247856c306b` | `ar` | `arabic_text` | *(null)* | `1.1` | **`candidate`** | `false` | `false` | 2026-08-20 20:52:44 |
| 2 | `pickthall-gutenberg-16955` | `f32639a6-8dc1-4be0-b8fc-bc9ac1c0fb76` | `en` | `translation` | Marmaduke Pickthall | Project Gutenberg eBook #16955 digital edition | `verified` | `false` | `true` | 2026-08-20 20:52:44 |
| 3 | `kazimirski-1869-segments-v1` | `f8443b10-3cc8-59ee-954f-5b1129c1cec4` | `fr` | `translation` | Albin de Kazimirski Biberstein | Charpentier, Paris, 1869 printing (translation first published 1840) | `candidate` | `false` | `true` | 2026-09-02 06:22:04 |
| 4 | `kazimirski-1869` | `ed6028cb-a507-4bf4-9f74-4b71602bb4e4` | `fr` | `translation` | Albin de Kazimirski (Biberstein) | Librairie Charpentier, 1869 edition | `candidate` | **`true`** | `true` | 2026-08-20 20:52:44 |
| 5 | `fr.hamidullah-crf` | `72059e3a-3b4c-4060-a221-0f91ca219ed6` | `fr` | `translation` | Muhammad Hamidullah | King Fahd Complex / Muslim World League revision (exact printing/date not independently confirmed) | `disputed` | `true` | `false` | 2026-09-01 02:45:51 |

Provenance / lifecycle metadata (from each row's `source_url`, `retrieved_at`,
`license_*`, `notes`):

- **`uthmani`** — Tanzil Project, Uthmani Script v1.1 (Feb 2021). `source_url`
  `https://tanzil.net/download/`. `retrieved_at` NULL. License "Creative Commons
  Attribution 3.0" (`attribution_required = true`, `modification_restricted =
  true`). Notes: "Canonical production Arabic source… text alteration is not
  allowed." No artifact hash in `notes`.
- **`pickthall-gutenberg-16955`** — Project Gutenberg eBook #16955.
  `retrieved_at` 2026-08-20 13:16:23. Notes carry the retrieved-artifact SHA-256
  (`8ea8efcd…`), a 4-item verse-label correction manifest (wording never altered),
  and a documented multi-candidate cross-comparison (differs from the verified 1930
  first edition at 1:4 / 2:255 / 6:9; agrees with it on the systematic "no God save
  Him" formula where a rejected candidate did not). This documented independent
  cross-comparison is the evidence basis on which it was promoted to `verified`
  (migration `20260820190000`).
- **`kazimirski-1869-segments-v1`** — fr.wikisource.org, Charpentier 1869 printing,
  Wikisource Avancement=V, Google Books `3XSe413MJyQC`, Harvard copy. `retrieved_at`
  2026-09-01 14:50:33. `id` is a pinned deterministic UUIDv5. Notes carry the raw
  artifact SHA-256 (`38f94de9…`) and an aggregate ordered segment-text SHA-256
  (`12015b8f…` over all 6239 segments in `(surah_number, source_ordinal)` order).
  Notes state explicitly why it is `candidate` not `verified`: Phase 5 human review
  validated **alignment/mapping mechanics**, not independent **translation-quality**
  sign-off against the Arabic (PRODUCTION-MIGRATION-IMPORT-DESIGN.md §21 Q1 remains
  open).
- **`kazimirski-1869`** — the Phase 2A (2026-08-20) flat-table provenance row.
  `source_url` the same Wikisource "Texte entier" page. `retrieved_at` NULL. Notes:
  "Interim/legacy FR translation for Phase 2A only, pending research and licensing
  of a modern French translation before production launch." `legacy_interim = true`.
- **`fr.hamidullah-crf`** — retroactively registers the source of the original
  58-ayah `ayahs.translation_fr` seed (migration `20260818042151`, from
  api.alquran.cloud). `disputed` on a documented consent/process objection
  (Hamidullah's 1989 open letter). Its 58 `translations` rows preserve the exact
  original text for provenance; `ayahs.translation_fr` was nulled for those rows.
  The application deliberately never reads this source or the legacy
  `translation_fr` column.

---

## 4. Reference counts

Live read-only counts, per source `id`, across every table with a `content_sources`
foreign key (`ayahs.arabic_source_id`, `surahs.metadata_source_id`,
`translations.source_id`, `translation_segments.source_id`, `lessons.content_source_id`),
plus `translation_segment_ayahs` resolved through its `segment_id → translation_segments.source_id`,
plus a grep of `src/`, `tests/`, `supabase/migrations/` and `scripts/`.

| Source | `ayahs.arabic_source_id` | `surahs.metadata_source_id` | `translations.source_id` | `translation_segments.source_id` | `translation_segment_ayahs` (via segment) | `lessons.content_source_id` | App code (`src/`) | Tests / fixtures | Migrations / import scripts |
|---|---|---|---|---|---|---|---|---|---|
| `uthmani` (`5fe9ddf8`) | **6236** | **114** | 0 | 0 | 0 | 0 | none direct — reader reads the `ayahs.arabic_text` column, never `content_sources` | referenced indirectly by spec 15 assertions on Arabic completeness | created/updated by `20260820100000`, `20260820110000`; referenced by `20260820140000`, `20260820160000` (inline `SELECT id … edition_identifier='uthmani'` per row) |
| `pickthall-gutenberg-16955` (`f32639a6`) | 0 | 0 | **6236** | 0 | 0 | 0 | `resolveVerifiedEnglishSource()` — by predicate, not id | specs 15, 49, 50, 51 filter by `edition_identifier` | `20260820170000` / `180000` / `190000`; `20260911110000` precondition |
| `kazimirski-1869-segments-v1` (`f8443b10`) | 0 | 0 | 0 | **6239** | **6396** | 0 | `resolveApprovedFrenchSource()` — by predicate, not id | specs 15, 49, 50, 51 + `src/lib/kazimirski.test.ts` (UUID appears **only** in test mock/fixture data and one doc comment) | `20260912100000` (schema + registration); data imported by `scripts/quran-import/kazimirski/import_production_kazimirski.py` |
| **`kazimirski-1869`** (`ed6028cb`) — legacy | **0** | **0** | **0** | **0** | **0** | **0** | **none** | **none** | INSERT in `20260820100000`; **comment-only** mention in `20260912100000` (precondition note "left untouched") and its staged copy; **comment-only** string in `scripts/quran-import/kazimirski/local-prototype/import_kazimirski.py:334` |
| `fr.hamidullah-crf` (`72059e3a`) | 0 | 0 | **58** | 0 | 0 | 0 | none (app never selects it; triple-excluded) | spec 49 (remediation) | `20260911110000` |

Supporting totals (live): `content_sources` 5, `ayahs` 6236, `surahs` 114,
`translations` 6294 (= 6236 Pickthall + 58 Hamidullah), `translation_segments` 6239,
`translation_segment_ayahs` 6396, `ayah_translations` 116, `lessons` 58.

- `translations.source_id` breakdown: `{pickthall-gutenberg-16955: 6236,
  fr.hamidullah-crf: 58}`. No `translations` row has ever pointed at either
  Kazimirski row (the French model is segment-based, in `translation_segments` /
  `translation_segment_ayahs`, exclusively under `kazimirski-1869-segments-v1`).
- `distinct ayahs.arabic_source_id` = `{5fe9ddf8-…}` (exactly one).
- `distinct translation_segments.source_id` = `{f8443b10-…}` (exactly one).
- `lessons.content_source_id`: **0 non-null** across all 58 lesson rows — this FK
  column exists but is entirely unused.
- `ayah_translations` (116 rows = 58 `en` + 58 `fr`): keyed by `(ayah_id, locale)`,
  **has no `source_id`/source column at all** — it is the i18n-foundation table
  (`20260909100000`), backfilled from the legacy `_en`/`_fr` columns for the
  7-surah / 58-ayah bootstrap set. It is **not referenced anywhere in `src/`**
  (only in generated `types.ts`) and is not on the Quran reader's Arabic/translation
  path. It carries no source-governance signal.
- No "join / audit / import / provenance" table beyond the five FK columns above
  exists in the schema. `translation_segments` / `translation_segment_ayahs` carry
  `reviewer_notes` / `reviewed_by` / `reviewed_at` columns (join-level review
  provenance) but no additional source linkage.

---

## 5. Legacy Kazimirski adjudication (Question 1)

**1. Which record is the certified active Reader source.**
`kazimirski-1869-segments-v1` (`f8443b10-3cc8-59ee-954f-5b1129c1cec4`). It owns all
6239 `translation_segments` and, transitively, all 6396 `translation_segment_ayahs`
joins; 6236/6236 canonical coverage; 0 orphans / 0 dangling / 0 duplicates;
`alignment_status` breakdown auto 5742 / cross 440 / human 57 (per Phase 8A §5,
unchanged). It is the only source the French reader path resolves.

**2. What content each legacy/interim record owns.**
`kazimirski-1869` (`ed6028cb`) owns **no content**: 0 `translations` rows, 0
`translation_segments`, 0 joins, 0 `ayahs`/`surahs` provenance references. It has
been an empty provenance-only row since it was inserted on 2026-08-20. (The Phase 2A
migration `20260820100000` inserted three provenance records and explicitly imported
**no** Qur'an text or translation rows; the flat `translations` model was never
populated for French — the only French text ever seeded, the 58 Hamidullah ayahs,
went into `ayahs.translation_fr` and is now attributed to `fr.hamidullah-crf`.)
There is no Phase 3 / other interim Kazimirski row in production.

**3. Whether anything still references those records.**
No. Zero foreign-key references in any table; zero references in `src/`; zero in
tests or fixtures. The only textual occurrences of the exact slug `kazimirski-1869`
(excluding `-segments-*`) are: the INSERT that created it (`20260820100000`), a
precondition **comment** in `20260912100000` (and its identical staged copy under
`scripts/quran-import/kazimirski/migrations-staging/`), and a **comment** string in
`scripts/quran-import/kazimirski/local-prototype/import_kazimirski.py`. None of these
read or depend on the row's continued existence.

**4. Whether a legacy record is needed for audit history / reproducibility /
provenance / rollback / migration replay / historical comparison.**

| Need | Assessment |
|---|---|
| Audit history | Already permanently captured in the immutable source of migration `20260820100000` (the row's full field values + rationale in its `notes`). The row itself holds no unique un-recorded information. |
| Reproducibility | The row has no artifact hash, no `retrieved_at`, and backs no data — nothing is reproducible *from* it. |
| Provenance | The successor row's own `notes` explicitly document the lineage ("successor of the local-only Phase 3 prototype … and distinct from the pre-existing empty legacy_interim flat-table row `kazimirski-1869`"). Provenance is preserved whether or not the legacy row stays. |
| Rollback | Nothing can be "rolled back to" this row — it backs no shipped content and the flat translation model was never used for French. |
| Migration replay | Replaying `20260820100000` re-INSERTs this row unconditionally (literal `VALUES`, no guard). No existing migration or import script *fails* if the row is absent (the `20260912100000` reference is a comment; `import_production_kazimirski.py` never touches it). So replay integrity does not depend on the row's current presence — and a `deprecated`-status UPDATE does not affect replay at all. |
| Historical comparison | The Phase 2C-A research (`scripts/quran-import/KAZIMIRSKI-RESEARCH.md`) that this row represents is preserved as a document; the row adds nothing to it. |

**5. Whether duplicate-looking rows represent duplicated content or different
import stages.**
Different import stages, not duplicated content. `kazimirski-1869` = Phase 2A
provenance-only stub (flat model, never populated). `kazimirski-1869-segments-v1` =
Phase 2–5 governed segment model (populated, certified for alignment). They share a
translator and a source page but differ in `edition_identifier`, `id`,
`content_type` payload model, `version` string, `translator` spelling
("… (Biberstein)" vs "… Biberstein"), `attribution_required`, `retrieved_at`, and
`legacy_interim`. No content is duplicated because the legacy row has no content.

**6. Whether deleting a legacy record would break a foreign key, audit trail,
migration replay or historical evidence.**
- Foreign key: no — 0 referencing rows in every child table.
- Audit trail: no — the creating migration's source is the audit record and is
  immutable.
- Migration replay: a *plain* re-run of `20260820100000` would re-insert the row
  (no `ON CONFLICT` guard), but migrations are not re-run against an
  already-migrated database in this project's workflow; no *new* migration or
  script depends on the row.
- Historical evidence: no — preserved in `notes` of the successor row and in the
  research document.
  Deletion is nonetheless **not recommended** (see §6): it is the only
  irreversible option, the row costs nothing to keep, and `deprecated` achieves
  every governance goal reversibly.

**7. Safest outcome.**
**`mark deprecated`** (schema-supported: `verification_status = 'deprecated'`),
with a `notes` append pointing to `kazimirski-1869-segments-v1`. Keep the row.
- vs. *keep unchanged*: acceptable, but leaves the row at `candidate` — the same
  tier as the live source — and relies solely on `legacy_interim` + the resolver's
  exact-identifier match to keep it unselectable. `deprecated` makes "obsolete, do
  not select" a first-class queryable fact and adds defense-in-depth.
- vs. *superseded / archive*: not schema-supported values; would require a schema
  change for no additional safety over `deprecated`.
- vs. *delete later via reviewed migration*: possible (the row is provably
  unreferenced) but strictly dominated by `deprecated` — irreversible, and
  discards the row's `notes`/history for zero operational gain.

---

## 6. Canonical Arabic verification adjudication (Question 2)

**Exact source edition and provenance.** Tanzil Project — Uthmani Script, version
`1.1` (copyright block in the artifact itself; dataset dated Feb 2021). License
"Creative Commons Attribution 3.0", verbatim copy/distribution with attribution
permitted, text alteration disallowed.

**Import origin.**
- 58 ayahs (7 surahs: 1, 67, 103, 108, 112, 113, 114) seeded 2026-08-18 by
  `20260818042151` from `api.alquran.cloud` edition `quran-uthmani`, with the
  Bismillah prefix stripped from ayah 1 of every surah except Al-Fatiha, and
  **cross-verified word-for-word against `api.quran.com` v4** (`bismillah_pre`
  agrees; `text_uthmani` matches post-strip; the only diffs across all 58 ayahs
  were tatweel / small annotation-mark formatting, not wording).
- 6178 further ayahs + 107 surahs added 2026-08-20 by `20260820160000`, generated by
  `scripts/quran-import/generate-arabic-migration.mjs` from a **fresh** tanzil.net
  fetch (public versioned download: `quranType=uthmani`, `marks=true`,
  `sajdah=true`, `alef=true`, `tatweel=true`). `20260820140000` backfilled
  `arabic_source_id` / `metadata_source_id` for the original 58 + 7.

**Source files and hashes.** Recorded **only in the `20260820160000` header
comment**:
- Tanzil text artifact SHA-256: `6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f`
- Tanzil metadata XML SHA-256: `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a`

These are **not** in `content_sources.notes` for `uthmani`, **not** stored per-row
(there is no `ayahs.text_sha256` column), and **not** stored as an aggregate corpus
hash. (Contrast: both the Pickthall and Kazimirski-v1 rows carry artifact and/or
aggregate SHA-256 values in their own `notes`.)

**Expected ayah numbering convention.** Canonical Uthmani / Cairo 1925 (King Fuad)
numbering, 6236 total. Per-surah `ayah_count` was validated against **Tanzil's own**
published `quran-data.xml` metadata (`ayas` attribute) — a self-consistency check
within one provider, not an independent one.

**Normalization / transformation history.**
- Bismillah prefix removed from ayah 1 of every surah except Al-Fatiha (Bismillah
  *is* its ayah 1) and At-Tawba (no Bismillah). The Bismillah string was derived
  from Al-Fatiha's own stored text, never hand-typed. The Al-Fatiha / At-Tawba
  exceptions and the shadda-idgham Bismillah of surahs 95 / 97 were explicitly
  validated.
- Pause marks, sajdah markers, superscript alef and tatweel are **retained** (fetch
  options above). No other transformation.

**Existing verification reports.** `scripts/quran-import/validate-tanzil.mjs` →
`scripts/quran-import/reports/` (structural gates: 1–114 surah coverage, per-surah
counts vs Tanzil metadata, no duplicate / out-of-range ayah numbers, no blank/null
text, Bismillah rule + exceptions; plus the read-only 58-ayah bootstrap comparison
classifying each row exact / formatting-only / substantive). `generate-arabic-migration.mjs`
re-runs the same gates and additionally aborts without writing if any freshly-parsed
Tanzil ayah substantively differs from an existing bootstrap ayah.

**Were the 6236 Arabic rows compared against an authoritative independent
reference?** **Only the 58-ayah bootstrap subset** was (against `api.quran.com` v4).
The other 6178 ayahs rest on the single Tanzil v1.1 artifact plus Tanzil's own
metadata file. No full 6236-ayah diff against a second independent Uthmani
digitization is on record.

**Were diacritics / orthography / pause marks / sajdah / basmala / Uthmani
conventions verified?** Only to the extent that (a) the Tanzil artifact was
ingested verbatim with mark-preserving options, (b) the Bismillah split rule was
applied and spot-checked on 58 ayahs (formatting-only diffs noted), and (c)
structural markers were counted against Tanzil's own metadata. There is **no**
systematic independent character-level comparison of rasm / diacritics / pause
marks across all 6236 ayahs.

**Does "6236 rows and no gaps" prove textual authenticity?** **No.** It proves
structural completeness and internal consistency only. Textual authenticity
currently rests on trust in the Tanzil Uthmani v1.1 digitization (a widely used,
reputable source) plus a 58-ayah spot check.

**Evidence classification.**
- The schema CHECK on `content_sources.verification_status` permits only
  `candidate | verified | disputed | deprecated`. **`cross_verified` and
  `human_verified` are not valid values for this column** — they exist on
  `translation_segments.alignment_status` / `translation_segment_ayahs.mapping_confidence`,
  a different model. So the task's suggested target statuses cannot be applied here
  without a schema change.
- Measured against this project's own working definition of `verified` (the
  documented, independent, multi-source cross-comparison performed for Pickthall
  before `20260820190000` promoted it), the Arabic source's current evidence is
  **insufficient for `verified`**.
- Correct classification today: **`candidate`** — provenance is strong and
  structure is proven, but independent textual verification of the full corpus is
  not yet done. **Do not promote on structural validation alone.**

**External authoritative comparison required before any promotion (identify only —
not run in this phase).**
- **Reference:** an independent Ḥafṣ/Uthmani digitization **not derived from
  Tanzil** — primarily the **King Fahd Glorious Qur'an Printing Complex (KFGQPC)
  digital Uthmani text** (`qurancomplex.gov.sa`), optionally corroborated by the
  **Quranic Arabic Corpus / Quran.com "QUL"** dataset. Note `api.quran.com`'s
  `text_uthmani` is itself Tanzil-derived and only weakly independent (it already
  covered the 58-ayah spot check).
- **Method:** normalize both corpora to Unicode NFC; character-level diff all 6236
  ayahs keyed by `(surah_number, ayah_number)`; categorize every diff as
  (a) annotation-mark / tatweel / pause-mark formatting, or (b) rasm / diacritic /
  wording. **Zero** category-(b) diffs ⇒ eligible for promotion; **any**
  category-(b) diff ⇒ STOP and escalate. Record the reference artifact URL +
  SHA-256, the full diff report, and an aggregate ordered SHA-256 of
  `ayahs.arabic_text` (in `(surah_number, ayah_number)` order) into
  `content_sources.notes` for `uthmani`.

---

## 7. Application-selection audit

| Path | Mechanism | Deterministic? | Can it pick a wrong/legacy source? |
|---|---|---|---|
| English translation | `resolveVerifiedEnglishSource()` — `.eq content_type='translation'` + `.eq language='en'` + `.eq translator='Marmaduke Pickthall'` + `.eq edition_identifier='pickthall-gutenberg-16955'` + `.eq verification_status='verified'`, `.maybeSingle()` | Yes | No. Four-predicate identity pin + explicit `verified` gate. |
| French translation | `resolveApprovedFrenchSource()` — `.eq content_type='translation'` + `.eq language='fr'` + `.eq translator='Albin de Kazimirski Biberstein'` + `.eq edition_identifier='kazimirski-1869-segments-v1'` + `.neq verification_status='disputed'`, `.maybeSingle()` | Yes | No. Legacy `kazimirski-1869` is excluded by **both** `edition_identifier` and `translator` ("… (Biberstein)" ≠ "… Biberstein"). `fr.hamidullah-crf` is excluded three ways (identifier, translator, `disputed`). |
| Segment fetch | `fetchKazimirskiRenderForSurah()` filters `translation_segments.source_id = <resolved id>` (embedded, `!inner`) | Yes | No — uses the resolved id, never language. |
| Pickthall fetch | `fetchTranslationsForSurah()` filters `translations.source_id = <resolved id>` | Yes | No. |
| Arabic text | Reader reads the `ayahs.arabic_text` column directly (`src/lib/quran.ts`); `content_sources` is **never queried** for Arabic. `arabic_source_id` is provenance-only. | Yes | N/A — no source selection occurs. The app hard-assumes exactly one Arabic corpus (true today: 1 distinct `arabic_source_id`). |

- **`single()` / `maybeSingle()`:** both resolvers use `.maybeSingle()`. If a future
  duplicate row ever matched all predicates, `.maybeSingle()` **throws** (PostgREST
  `PGRST116`) — the reader would surface an error, never silently serve the wrong
  row. This is fail-safe, not "first row wins". No `.single()`/`.limit(1)`/
  unordered-first pattern exists on `content_sources`.
- **Language-only filters:** none. Both resolvers pin `translator` + `edition_identifier`.
- **Hardcoded IDs:** `f8443b10-…` appears **only** in test mocks/fixtures
  (`src/lib/kazimirski.test.ts`, `tests/e2e/49,50`) and one doc comment — never in
  `src/` runtime code. No source UUID is hardcoded in application logic.
- **Fallback paths:** English falls back `verified normalized → legacy
  `translation_en` column → "unavailable"`. French falls back `governed segment
  model → "unavailable"` and **never** reads `translation_fr` (deliberate — that
  column only ever held disputed Hamidullah text). Neither fallback can cross
  languages or reach a legacy/disputed `content_sources` row.

**Real application-selection defects found: none.**

**Optional hardening (low severity, distinct from DB governance):**
`resolveApprovedFrenchSource()` gates with `.neq('verification_status','disputed')`
rather than an allow-list. If the v1 row's status were ever changed to `deprecated`
or a future `rejected`-like value, the resolver would still serve it. Because the
row is identity-pinned this is latent only. A stricter form —
`.in('verification_status', ['candidate','verified'])` — would fail safe instead.
Not required; recorded for the implementation phase.

---

## 8. Risk analysis

| # | Risk | Likelihood | Impact | Notes |
|---|---|---|---|---|
| R1 | Legacy `kazimirski-1869` selected by a **future** hand-written query filtering French by `language`/`translator` alone | Low | Medium (serves an empty/legacy source) | Current resolvers are safe; risk is only for code not yet written. `deprecated` + allow-list mitigations both address it. |
| R2 | Legacy row at `candidate` misleads a human auditor into treating it as viable | Low | Low | `legacy_interim=true` already signals this; `deprecated` makes it unambiguous. |
| R3 | Arabic corpus altered out-of-band with no independent tripwire | Low | **High** (canonical scripture) | No aggregate/`per-row` hash in DB for Arabic; the strict validator checks structure + completeness but not text bytes against a pinned hash. Adding an aggregate `arabic_text` SHA-256 assertion closes this regardless of the status decision. |
| R4 | Promoting `uthmani` to `verified` on structural evidence alone | Low (guarded by this adjudication) | High | Would assert a verification claim the project has not earned for 6178 of 6236 ayahs. Explicitly **not** recommended. |
| R5 | Schema cannot express "canonical scripture, structurally validated" as distinct from "unreviewed translation candidate" | Certain (current state) | Low | Both sit at `candidate`. Resolving this needs a deliberate schema decision (new status value or a `canonical_reference` flag), not a data change. |
| R6 | Duplicate staged migration file (`scripts/quran-import/kazimirski/migrations-staging/20260912100000_*.sql`) is byte-identical to the promoted `supabase/migrations/` copy | Certain | Very low | Confirmed identical. Harmless (staging dir is not picked up by `supabase db push`), but a stale duplicate. Out of scope to change here; noted. |

No risk identified rises to a production content-integrity violation. The strict
validator is **27/27** and every canonical count matches Phase 8A.

---

## 9. Recommended decisions

### Question 1 — legacy `kazimirski-1869`

| Field | Value |
|---|---|
| Current state | Empty provenance-only row; `legacy_interim=true`; `verification_status='candidate'`; **0** references anywhere. |
| Evidence | §3, §4, §5. |
| Risk if unchanged | Low (R1, R2). App cannot select it today. |
| Recommended decision | **Mark `deprecated`** (keep the row; append `notes` pointer to `kazimirski-1869-segments-v1`). *Acceptable alternative:* keep unchanged. **Do not delete.** |
| Confidence | High. |
| Human review required | **Yes** — governance decision (deprecate vs. keep). Low stakes. |
| Proposed DB change | One-row `UPDATE public.content_sources SET verification_status='deprecated', notes = notes || ' [Phase 8C: deprecated — superseded by kazimirski-1869-segments-v1 (f8443b10-3cc8-59ee-954f-5b1129c1cec4); retained for provenance.]' WHERE id='ed6028cb-a507-4bf4-9f74-4b71602bb4e4' AND edition_identifier='kazimirski-1869' AND legacy_interim=true;` in a reviewed migration. |
| Proposed app change | None required. *Optional:* switch `resolveApprovedFrenchSource()` to `.in('verification_status', ['candidate','verified'])`. |
| Proposed validator assertion | Add: "no `content_sources` row has `legacy_interim=true` AND `verification_status='candidate'`"; and/or "if a `kazimirski-1869` row exists it is `deprecated` and has 0 child references". |
| Rollback | `UPDATE public.content_sources SET verification_status='candidate' WHERE id='ed6028cb-…';` (plus restore `notes` from the pre-migration value captured in the migration body). |
| Proof Quran content unchanged | Migration touches **only** `content_sources` (1 row, columns `verification_status` + `notes`). Never touches `ayahs`, `translations`, `translation_segments`, `translation_segment_ayahs`, `surahs`. Strict validator (27/27) re-run as the migration's own postcondition and in `production-validation.yml`. |

### Question 2 — canonical Arabic `uthmani`

| Field | Value |
|---|---|
| Current state | 6236/6236 structurally complete & consistent; textual authenticity anchored only to Tanzil v1.1 + a 58-ayah spot cross-check; artifact hash only in a migration comment. |
| Evidence | §3, §6. |
| Risk if unchanged | Low for users (complete, reputable source). Governance-taxonomy + missing-tripwire gap (R3, R5). |
| Recommended decision | **NO status change now — `candidate` stands.** Promotion to `verified` requires the external comparison in §6, performed and signed off by a qualified reviewer. Do not promote on structural validation. |
| Confidence | High (that `candidate` is correct today). |
| Human review required | **Yes** — and external authoritative comparison is a prerequisite, not just a review. |
| Proposed DB change | **None now.** *Future, gated:* a promote migration mirroring `20260820190000` — re-assert 6236 ayahs / exactly one `uthmani` source / 0 NULL `arabic_source_id`; verify a recorded aggregate `arabic_text` SHA-256 equals a freshly computed one; then `UPDATE … SET verification_status='verified' WHERE edition_identifier='uthmani'` — only after §6 sign-off. Separately, a small **non-gating** migration could add the Tanzil artifact + aggregate corpus SHA-256 into `content_sources.notes` for `uthmani` (metadata only, no text change), bringing it in line with the Pickthall/Kazimirski rows. |
| Proposed app change | None (the app does not read `verification_status` for Arabic). |
| Proposed validator assertion | Add an aggregate ordered SHA-256 of `ayahs.arabic_text` (in `(surah_number, ayah_number)` order) pinned to a constant — locking the Arabic corpus byte-for-byte, independent of the status decision. Requires a one-time computation of the baseline hash (read-only) to seed the constant. |
| Rollback | Status change (if ever made): single `UPDATE … SET verification_status='candidate'`. Notes-only metadata migration: restore prior `notes`. Corpus never touched either way. |
| Proof Quran content unchanged | All proposed migrations read/assert only, except a single `content_sources` write (`verification_status` and/or `notes`). `ayahs.arabic_text` is never in an `UPDATE`/`DELETE` target. Strict validator (27/27) + the new aggregate-hash assertion re-run after. |

### Schema-taxonomy item (both questions touch it)

`content_sources.verification_status ∈ {candidate, verified, disputed, deprecated}`.
If the project wants a status that says "canonical scripture, structurally
validated, independent textual review pending" — distinct from an unreviewed
translation candidate — that is a **schema change** (add a value via a
CHECK-constraint migration, or add a `canonical_reference boolean`/`source_tier`
column). Flagged as a human-review item. It is **not** required to resolve Q2:
keeping `uthmani` at `candidate` is correct under the current schema.

---

## 10. Proposed implementation plan (design only — nothing executed)

All items are for a **later, separately authorized** phase. Ordered.

1. **`analysis/` → `feat/` branch** off `main`, after human sign-off on §9.
2. **Migration `A` — deprecate legacy Kazimirski** (`supabase/migrations/<ts>_<uuid>.sql`):
   - Preconditions (abort on any miss, single `DO $$` block): exactly one row
     `WHERE id='ed6028cb-…' AND edition_identifier='kazimirski-1869' AND
     legacy_interim=true AND verification_status='candidate'`; and
     `0 = (SELECT count(*) FROM translations WHERE source_id=<id>) +
     (SELECT count(*) FROM translation_segments WHERE source_id=<id>) +
     (SELECT count(*) FROM ayahs WHERE arabic_source_id=<id>) +
     (SELECT count(*) FROM surahs WHERE metadata_source_id=<id>) +
     (SELECT count(*) FROM lessons WHERE content_source_id=<id>)`.
   - Capture `notes` into a local variable for the rollback comment.
   - `UPDATE` (status + notes append), `WHERE` clause repeats the full identity
     predicate; assert `ROW_COUNT = 1`.
   - Postconditions: row now `deprecated`; `content_sources` still 5 rows; 6236
     ayahs / 6236 Pickthall / 6239 segments / 6396 joins unchanged.
   - `BEGIN`/`COMMIT` (transactional). Rollback documented inline.
3. **Migration `B` (optional, non-gating) — Arabic provenance metadata**: append
   the Tanzil text + metadata SHA-256 and a freshly-computed aggregate
   `arabic_text` SHA-256 to `content_sources.notes` for `uthmani`. Metadata only;
   identical precondition/postcondition rigor; `arabic_text` never in an `UPDATE`.
4. **Validator additions** (`scripts/validate-quran-content.mjs`, read-only):
   - `legacy_interim=true ⇒ verification_status ∈ {deprecated, disputed}` for every
     `content_sources` row.
   - Aggregate ordered SHA-256 of `ayahs.arabic_text` equals a pinned constant.
   - (If `A` ships) a `kazimirski-1869` row, if present, is `deprecated` with 0
     child references.
5. **Optional app hardening**: `resolveApprovedFrenchSource()` allow-list
   (`verification_status IN ('candidate','verified')`) + a `kazimirski.test.ts`
   case proving a `deprecated` row is not served.
6. **Do NOT** in this plan: change `uthmani` to `verified` (needs §6 external
   comparison first); delete any `content_sources` row; touch any text, segment or
   mapping; alter the Hamidullah row or its 58 preserved `translations` rows.
7. After any migration: run strict `REQUIRE_KAZIMIRSKI_SOURCE=true npm run
   validate:quran-content` against production (read-only) and confirm 27/27 (now
   28/28+ with the new assertions), then the spec-51 smoke suite via the normal
   approval-gated pipeline.

**Files/migrations expected for the implementation phase:**
`supabase/migrations/<ts>_<uuid>.sql` (deprecate legacy Kazimirski),
optionally `supabase/migrations/<ts>_<uuid>.sql` (Arabic provenance-metadata note),
`scripts/validate-quran-content.mjs` (new read-only assertions),
optionally `src/lib/kazimirski.ts` + `src/lib/kazimirski.test.ts` (allow-list
hardening), and a follow-up doc `PHASE8D-ARABIC-CROSS-VERIFICATION.md` for the §6
external comparison.

---

## 11. Required human-review items

1. **Decision on Q1:** deprecate the legacy `kazimirski-1869` row, or keep it
   unchanged. (Recommendation: deprecate.)
2. **Decision on Q2:** accept that `uthmani` remains `candidate` for now, and
   authorize (or not) the §6 external cross-verification effort as a follow-up
   phase.
3. **Qualified textual reviewer** for the §6 Arabic comparison — the category-(b)
   diff sign-off is a scholarly judgment, not an automatable check.
4. **Schema-taxonomy call:** whether to introduce a distinct status/flag for
   canonical scripture vs. translation candidates (§9 last block).
5. **Optional app hardening:** whether to change `resolveApprovedFrenchSource()`
   from `!= disputed` to an explicit allow-list.
6. **Housekeeping (non-blocking):** the byte-identical staged duplicate
   `scripts/quran-import/kazimirski/migrations-staging/20260912100000_*.sql`.

---

## 12. Explicit list of actions NOT taken

- No `content_sources` row created, deleted, deactivated, renamed or updated
  (no `verification_status`, `legacy_interim`, `notes` or any other column change).
- No change to `verification_status` on any row.
- No migration written to `supabase/migrations/`, and none run (local or
  production).
- No Kazimirski segment or mapping altered; no `translation_segments` /
  `translation_segment_ayahs` write.
- No Arabic, Pickthall or French text altered; no `ayahs` / `translations` write.
- No promotion of `uthmani` (or any source) to `verified`.
- No external corpus fetched, imported or compared (the §6 method is specified, not
  executed).
- No deployment; no Cloudflare or GitHub configuration change; no secret read or
  exposed (the publishable/anon key used is the client-visible, RLS-limited key
  already in `.env` and `.env.example`).
- No commit, no push, no branch merge, no PR opened. The branch
  `analysis/phase8c-content-source-governance` was created locally and only this
  document was added to the working tree.
- All database access was **read-only**: the strict validator
  (`scripts/validate-quran-content.mjs`, `SELECT`-only, anon key) and a temporary
  read-only inventory script (`SELECT`-only, anon key, removed after use).

---

## 13. Final report

- **Overall result:** `HUMAN REVIEW REQUIRED`.
  - Q1 sub-verdict: `READY FOR GOVERNANCE FIX` — deprecate the legacy row (minimal,
    reversible, provenance-preserving), pending a human governance decision.
  - Q2 sub-verdict: `NO CHANGE RECOMMENDED NOW` — `uthmani` stays `candidate`;
    promotion is blocked on human-led external verification (§6).
- **Strict validator baseline:** 27 / 27 passed, 0 failed (production, read-only,
  `REQUIRE_KAZIMIRSKI_SOURCE=true`), re-confirmed this phase.
- **Source records discovered:** 5 in production — `uthmani` (ar, candidate),
  `pickthall-gutenberg-16955` (en, verified), `kazimirski-1869-segments-v1` (fr,
  candidate, active), `kazimirski-1869` (fr, candidate, `legacy_interim`, empty),
  `fr.hamidullah-crf` (fr, disputed). No `kazimirski-1869-segments-phase3` in
  production.
- **Reference counts — Kazimirski:**
  - `kazimirski-1869-segments-v1`: 6239 `translation_segments`, 6396
    `translation_segment_ayahs`; 0 `translations`; 0 `ayahs`/`surahs`/`lessons`;
    resolved by predicate in `src/lib/kazimirski.ts`; UUID in test fixtures only.
  - `kazimirski-1869` (legacy): **0** everywhere — 0 `translations`, 0
    `translation_segments`, 0 joins, 0 `ayahs.arabic_source_id`, 0
    `surahs.metadata_source_id`, 0 `lessons.content_source_id`, 0 in `src/`, 0 in
    tests; comment-only in 2 files.
- **Reference counts — Arabic:**
  - `uthmani`: 6236 `ayahs.arabic_source_id`, 114 `surahs.metadata_source_id`; 0
    `translations`/segments/joins/lessons; **0 references in application code**
    (reader reads the `arabic_text` column directly); referenced inline per-row by
    import migrations `20260820140000` / `20260820160000`.
- **Legacy Kazimirski recommendation:** mark `deprecated` in a future minimal,
  idempotent, precondition-guarded, transactional, reversible migration; append a
  `notes` pointer to the successor; **do not delete**. App change not required
  (optional allow-list hardening). Add validator assertions.
- **Canonical Arabic recommendation:** keep `candidate`. Do not promote on
  structural validation. Required for promotion: full 6236-ayah NFC character-level
  diff of `ayahs.arabic_text` against an independent non-Tanzil Uthmani
  digitization (KFGQPC primary; QUL/Quran.com corroborating), categorized
  formatting vs. rasm/diacritic, with the reference artifact hash, diff report and
  an aggregate corpus SHA-256 recorded in `content_sources.notes` — performed by a
  qualified reviewer in a later authorized phase. Independently of the status
  decision, add an aggregate `arabic_text` SHA-256 assertion to the validator and
  the artifact hashes to the row's `notes`.
- **Application-selection defect:** none. Both resolvers are deterministic,
  identity-pinned, `.maybeSingle()` (fail-safe on duplicates), no language-only
  filter, no hardcoded ID in runtime code, no cross-language fallback. One optional
  low-severity hardening: French resolver uses `!= disputed` rather than an
  allow-list.
- **Proposed files / migrations for the implementation phase:**
  `supabase/migrations/<ts>_<uuid>.sql` (deprecate `kazimirski-1869`);
  optionally `supabase/migrations/<ts>_<uuid>.sql` (Arabic provenance-metadata
  note); `scripts/validate-quran-content.mjs` (read-only assertions);
  optionally `src/lib/kazimirski.ts` + `src/lib/kazimirski.test.ts`;
  follow-up `PHASE8D-ARABIC-CROSS-VERIFICATION.md`.
- **Risks & rollback:** see §8. Highest-rated is R3 (no byte-level tripwire on the
  Arabic corpus) — mitigated by the proposed aggregate-hash validator assertion,
  which needs no data change. Every proposed DB change is a single `content_sources`
  row write with a documented one-statement revert; no proposed change can touch
  Qur'an text, segments or mappings.
- **Document path:** `PHASE8C-CONTENT-SOURCE-GOVERNANCE.md` (this file), on local
  branch `analysis/phase8c-content-source-governance`.
- **Confirmation — all database activity was read-only:** yes. Only the strict
  validator and a temporary read-only inventory script ran, both `SELECT`-only via
  the publishable/anon key under RLS SELECT policies. No `INSERT`/`UPDATE`/`DELETE`/
  `rpc`/DDL was issued.
- **Confirmation — no commit, push, PR, deployment or data change occurred:** yes.
  No git commit/push/PR; no migration executed; no deployment triggered; no
  production or local row, secret or configuration modified.

---

## 14. Phase 8C.2 — legacy Kazimirski governance fix (migration prepared, NOT applied)

### 14.1 Approved human decision

Recorded verbatim from the Phase 8C.2 instruction:

1. **Approved:** mark the empty legacy source `kazimirski-1869` as `deprecated`.
2. Preserve the row **permanently** for provenance, reproducibility and audit
   history.
3. Add a clear successor reference to `kazimirski-1869-segments-v1` in its `notes`.
4. **Do not delete** the legacy source.
5. **Do not change** the active `kazimirski-1869-segments-v1` source.
6. **Do not promote** canonical Arabic — `uthmani` remains `candidate`.
7. Arabic external cross-verification is deferred to **Phase 8D**.

This phase is preparation + PR only. The migration is **not** applied to
production, CI or any local shared database.

### 14.2 Why deprecation, not deletion

- **Provenance / audit:** the legacy row is the on-database record of the Phase 2A
  French-source decision. `deprecated` keeps that record and its `notes` intact and
  adds an explicit, queryable "obsolete — do not select" signal on top of the
  existing `legacy_interim = true` flag.
- **Reproducibility / migration replay:** migration `20260820100000` inserts this
  row unconditionally; a `deprecated` status does not interfere with replay, whereas
  a deleted row would diverge from every historical dump and from a replayed
  `20260820100000`.
- **Reversibility:** `deprecated` is a one-statement, fully reversible metadata
  change. Physical deletion is irreversible and — because the row is already
  provably unreferenced and costs nothing to keep (§4, §5) — buys nothing.
- **Safety:** deletion is the only option that could, in principle, break a
  future audit query, a historical foreign-key expectation, or a replayed
  migration. Deprecation cannot.

Full comparison of outcomes (keep / deprecate / superseded / archive / delete) is
in §5.7. `superseded` and `archive` are not schema-supported
`verification_status` values and would need a schema change for no added safety
over `deprecated`.

### 14.3 The migration

**File:** `supabase/migrations/20260913100000_7872f932-bfd3-42d6-b36c-36e4b8587c81.sql`
(sorts immediately after the current highest migration,
`20260912100000_4bddf81d-…`).

**Target identity — stable predicates, never a bare copied UUID:**

| predicate | value |
|---|---|
| `content_type` | `'translation'` |
| `language` | `'fr'` |
| `edition_identifier` | `'kazimirski-1869'` |
| `legacy_interim` | `true` |

(The audited production `id` is `ed6028cb-a507-4bf4-9f74-4b71602bb4e4`; it appears
in a comment for reference only and is **not** used as the match key.)

**Exact preconditions** (each failure ⇒ `RAISE EXCEPTION`, whole migration aborts
with no partial effect; the single `DO` block is atomic and runs inside the
migration runner's per-file transaction):

1. **Exactly one** `content_sources` row matches the four identity predicates
   above (0 ⇒ abort "no row matches"; >1 ⇒ abort "ambiguous set").
2. **Exactly one** active successor row exists (`content_type='translation'`,
   `language='fr'`, `edition_identifier='kazimirski-1869-segments-v1'`).
3. The legacy row's `verification_status` is **`candidate`** — *or* it is already
   `deprecated` **and** already carries the `\n\n[Phase 8C: ` note marker, in
   which case the migration is a **safe no-op** (`RAISE NOTICE`, `RETURN`). Any
   other status (`verified`, `disputed`, or `deprecated` *without* the marker)
   aborts with a clear "unexpected state" error.
4. The legacy row has **zero** referencing rows from **every** foreign key that
   targets `public.content_sources`. The FK set is discovered dynamically from
   `pg_constraint` at run time, so a foreign key added by any later migration is
   covered without editing this file. Known FKs today: `ayahs.arabic_source_id`,
   `surahs.metadata_source_id`, `translations.source_id`,
   `translation_segments.source_id`, `lessons.content_source_id`.

**Effect (first application only):**

- `verification_status`: `'candidate'` → `'deprecated'`.
- `notes`: existing text preserved **verbatim**; one single-line successor
  reference appended after a `\n\n[Phase 8C: ` marker (names
  `kazimirski-1869-segments-v1` and states the row is retained, not deleted, and
  that no child content was modified).
- **Exactly one row** affected (`GET DIAGNOSTICS … ROW_COUNT`; anything other
  than 1 aborts and rolls back).
- **No timestamp column is set** — `public.content_sources` has no `updated_at`
  column and no `updated_at` trigger; that is this table's established convention
  (contrast `public.translations`, which has both).

**Idempotency behaviour:**

| starting state | result |
|---|---|
| `candidate`, no marker | → `deprecated`, marker appended, 1 row affected |
| `deprecated`, marker present | **no-op** — `RAISE NOTICE`, 0 rows affected |
| applied twice in one run | second pass is the no-op above; marker present exactly once |
| `verified` / `disputed` | abort with "unexpected state" error |
| `deprecated`, marker absent | abort with "unexpected state" error |
| 0 or >1 identity matches | abort (precondition 1) |
| successor missing / duplicated | abort (precondition 2) |
| any child FK reference | abort (precondition 4) |

### 14.4 Rollback

One statement. Restores **only** the governance metadata (status + the appended
note slice); touches no other column and no other table:

```sql
UPDATE public.content_sources
SET verification_status = 'candidate',
    notes = left(notes, position(E'\n\n[Phase 8C: ' in notes) - 1)
WHERE content_type = 'translation'
  AND language = 'fr'
  AND edition_identifier = 'kazimirski-1869'
  AND legacy_interim = true
  AND position(E'\n\n[Phase 8C: ' in coalesce(notes, '')) > 0;
```

Not to be run as part of normal operation. The same statement is reproduced in the
migration's header comment.

### 14.5 Confirmations

- **`uthmani` remains `candidate`.** This migration does not reference the
  `uthmani` row, `arabic_text`, `ayahs` or `surahs` in any way. The migration
  test (§14.6, case 10) asserts the `uthmani` row is unchanged after the
  migration runs.
- **Active `kazimirski-1869-segments-v1` is unchanged.** Not referenced by any
  `UPDATE`/`INSERT`/`DELETE` in the migration; only counted (precondition 2).
  Test case 9 asserts its `verification_status` and `notes` are unchanged.
- **No Qur'an text, translation rows, segments or joins are modified.** The
  migration's only write is `UPDATE public.content_sources … WHERE id = <legacy>`
  affecting two columns of one row. Test case 11 asserts child-table contents are
  unchanged.

### 14.6 Migration-level verification (no production-state validator added)

**Harness:** `scripts/db-migration-tests/phase8c-deprecate-legacy-kazimirski.test.sh`.
It starts a **disposable Docker PostgreSQL** container (`--rm`, force-removed on
exit), builds a minimal faithful fixture (the real `content_sources` DDL — CHECK
constraints included — plus stub child tables carrying only the FK columns that
reference it, plus one synthetic extra FK table), seeds a production-like 5-row
`content_sources` state, then runs each case **inside its own
`BEGIN … ROLLBACK` transaction** so nothing persists. It never touches
production, CI, or any local shared database. If Docker is unavailable it prints
`SKIP` and exits 0 — it is a local developer check, **not** a new CI gate (no
production-state validator requirement is introduced in this phase).

**Result (this preparation session): 13/13 checks passed, 0 failed** — covering:

| # | case | expectation | result |
|---|---|---|---|
| 1 | correct `candidate` row | exactly one row → `deprecated` | PASS |
| 2 | migration applied twice | second application is a no-op | PASS |
| 3 | legacy source missing | explicit failure | PASS |
| 4 | duplicate legacy sources | explicit failure | PASS |
| 5 | active successor missing | explicit failure | PASS |
| 6a | child reference in `translations` | explicit failure | PASS |
| 6b | child reference in `lessons` | explicit failure | PASS |
| 6c | child reference via an FK **not named** in the migration | explicit failure (dynamic sweep) | PASS |
| 7 | existing `notes` preserved verbatim as the prefix | PASS | PASS |
| 8 | successor note not duplicated (single application) | PASS | PASS |
| 9 | active `kazimirski-1869-segments-v1` unchanged | PASS | PASS |
| 10 | canonical Arabic `uthmani` unchanged | PASS | PASS |
| 11 | child content (row counts) unchanged | PASS | PASS |

**Limitation of the test environment:** the fixture reproduces
`content_sources` exactly and the child tables only at the level of their
foreign-key column to `content_sources` (enough to exercise every precondition
and the "nothing else changes" guarantees). It does not replay all 43 real
migrations, and it does not — and must not — run against production. The strict
27/27 production content-integrity validator is the check that runs against real
data, after the migration is applied through the authorized procedure (§14.7).

### 14.7 Rollout sequence

1. **Review and merge** this migration + documentation PR
   (`feature/phase8c-legacy-source-governance` → `main`). *(This task stops here —
   the PR is opened, not merged.)*
2. **Apply the migration to production** through the project's authorized
   production migration procedure, with its own separate approval. Not via this
   task, not via CI, not via a local push.
3. **Run the strict validator** (`REQUIRE_KAZIMIRSKI_SOURCE=true npm run
   validate:quran-content`) against production and confirm **27/27**.
4. **Verify the one-row effect:** the `kazimirski-1869` row is `deprecated` with
   the successor note; `kazimirski-1869-segments-v1` is still `candidate` with
   6239 segments / 6396 joins; `uthmani` is still `candidate`; 6236 ayahs / 6236
   Pickthall unchanged.
5. **Follow-up PR — permanent automated assertions** (only *after* step 2/3 make
   them true, so current CI never goes red before the migration is applied):
   - the specific legacy `kazimirski-1869` row is `deprecated`;
   - every `legacy_interim = true` source is `deprecated` or `disputed`;
   - the active Kazimirski source resolves uniquely (one row for
     `edition_identifier = 'kazimirski-1869-segments-v1'`);
   - a pinned aggregate `ayahs.arabic_text` SHA-256 is unchanged.
6. **Phase 8D** — separate effort for independent Arabic cross-verification
   (§6): full 6236-ayah character-level diff of `ayahs.arabic_text` against an
   independent non-Tanzil Uthmani digitization, by a qualified reviewer, before
   any `uthmani` promotion is even considered.

Rollout-stage-5 enforcement is deliberately **not** in this PR, because
production has not received the migration yet and a validator asserting
"`kazimirski-1869` is `deprecated`" would fail CI immediately on merge.

### 14.8 Phase 8C.2 — actions explicitly NOT taken

- No migration applied to any database (production, CI, local shared, or the
  disposable test container beyond rolled-back transactions).
- No `content_sources` row created, deleted, deactivated or renamed. No row's
  `verification_status` changed in any real database.
- The legacy `kazimirski-1869` row is **preserved** — the migration deprecates it,
  it does not delete it, and this task does not run the migration.
- `kazimirski-1869-segments-v1` (active) not modified in any way.
- `uthmani` (canonical Arabic) not modified and **not promoted** — stays
  `candidate`; cross-verification deferred to Phase 8D.
- No Qur'an text, translation rows, `translation_segments`,
  `translation_segment_ayahs` or `lessons` rows read for modification or written.
- No workflow / CI file changed (none needed for this phase).
- No production-state validator rule added (deferred to the post-migration
  follow-up PR, per the rollout sequence).
- No deployment. No secrets or production connection strings written to any file.
- PR opened, **not merged**.
