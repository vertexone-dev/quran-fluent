# Kazimirski Production Migration + Import — Execution Runbook

Status: **EXECUTED — see `PRODUCTION-IMPORT-EXECUTION-REPORT.md` for the full execution record.** This document originally described the planned procedure; the actual execution used `run_kazimirski_production_execution.py` (a direct-Postgres adapter built and rehearsed in a later gate) rather than the `supabase db push --linked` CLI step originally envisioned in §8 step 1 — the schema migration and the data import were both applied via that same script, through one connection, in the same session.

## 1. Scope

Adds two new tables (`translation_segments`, `translation_segment_ayahs`) and one new `content_sources` row (`kazimirski-1869-segments-v1`) to production. Does not modify any existing table, row, or migration. Does not touch `ayahs`, existing `translations` rows, or the disputed `fr.hamidullah-crf` remediation.

## 2. Production identity (must match before any step runs)

- Supabase project ref: `wubzdnuwrhmrodwqkicg`
- Project name: `Quran Learning App`
- Org slug: `druutmrsmgdnknjgunqq`
- Source of truth: `VITE_SUPABASE_URL` in `.env` must resolve to this ref, and must match `project_id` in `supabase/config.toml`.
- **STOP condition:** if the linked project ref differs from `wubzdnuwrhmrodwqkicg` at execution time, halt immediately — do not proceed on an assumption that "it's probably fine."

## 3. Preconditions (all independently re-verified read-only, at the time this runbook was written)

| # | Precondition | Verified value |
|---|---|---|
| 1 | Expected git commit at time of promotion | `1049ee37599b773b94c441153a4bcc61113fc28f` |
| 2 | Kazimirski migration is the only pending migration | Confirmed via `supabase migration list --linked`: `20260912100000` is the sole entry with empty `remote` |
| 3 | `translation_segments` absent in production | Confirmed via direct `SELECT *` → `PGRST205` |
| 4 | `translation_segment_ayahs` absent in production | Confirmed via direct `SELECT *` → `PGRST205` |
| 5 | No `kazimirski-1869-segments-v1` content_sources row in production | 0 rows |
| 6 | No `f8443b10-3cc8-59ee-954f-5b1129c1cec4` id in production | 0 rows |
| 7 | Production `content_sources` = 4 rows (`fr.hamidullah-crf`, `kazimirski-1869`, `pickthall-gutenberg-16955`, `uthmani`) | Confirmed; local dev's 5th row (`kazimirski-1869-segments-phase3`) is a local-only Phase 3 prototype fixture created via direct `psql`, never part of any migration — its absence in production is expected, not a defect |
| 8 | Canonical Arabic fingerprint matches every prior local computation | `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b` |
| 9 | Pickthall fingerprint (full pagination) matches every prior local computation | `501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` |
| 10 | Disputed French remediation intact in production | 58 rows, `verification_status='disputed'` |
| 11 | No existing migration file altered | `git status --short supabase/migrations/` shows only the one new untracked file |
| 12 | `src/` unchanged by this entire project | Confirmed clean |

## 4. Frozen artifact identity

- File: `scripts/quran-import/kazimirski/generated/kazimirski-production-import.json`
- Full-file SHA256: `6ae5f4178b3c39d0132bb92cd7a54bad43df06e740c32538330b1061223c050f`
- `canonical_payload_sha256` (embedded): `46435278f3bf1b8323391b8f9a825f35200493828e2f5dc071a54ba76fb57303`
- `raw_source_sha256` (embedded, traces to the frozen Wikisource HTML): `38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92`
- `aggregate_segment_text_hash` (embedded): `12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26`
- `manifest_hash` (embedded, traces to `kazimirski_alignment_manifest.json`): `04c6d562a440f661bf4b80d690c877b8691eed567ec55cb1062937e05a2f8a1e`
- `schema_version`: `1.0.0`; `generator_version`: `kazimirski-import-gen-v1`
- Any mismatch on any of the above at execution time is a hard STOP — never regenerate or re-derive the artifact to "fix" a mismatch; investigate first.

## 5. Migration file

- Path (already promoted, not yet applied): `supabase/migrations/20260912100000_4bddf81d-6e3e-4260-a2a2-89c4b5b3f933.sql`
- Confirmed byte-identical to the staging copy at `scripts/quran-import/kazimirski/migrations-staging/20260912100000_4bddf81d-6e3e-4260-a2a2-89c4b5b3f933.sql`
- Contains: both table DDLs, constraints, indexes, RLS policies, immutability trigger, cross-surah-consistency trigger, and the single `content_sources` INSERT using the hardcoded deterministic id `f8443b10-3cc8-59ee-954f-5b1129c1cec4`.
- Idempotent precondition check embedded in the migration itself (raises/aborts unless 6236 canonical ayahs, 6236 Pickthall rows, no pre-existing target tables, no pre-existing source row).

## 6. Expected post-migration-only state (before import runs)

- `translation_segments`: table exists, 0 rows
- `translation_segment_ayahs`: table exists, 0 rows
- `content_sources`: exactly 1 new row, id `f8443b10-3cc8-59ee-954f-5b1129c1cec4`, edition_identifier `kazimirski-1869-segments-v1`, `verification_status='candidate'` is NOT yet set by the migration — check actual default the migration assigns and confirm it matches design intent before treating this as a pass/fail signal.

## 7. Expected post-import state

| Metric | Expected value |
|---|---|
| segments | 6239 |
| joins | 6396 |
| canonical coverage | 6236 / 6236 |
| unresolved segments | 0 |
| human_verified segments | 57 |
| human_verified joins | 80 |
| Tier 2 human_verified joins | 17 |
| alignment_type breakdown | direct 2909, offset 2877, one_to_many 144, many_to_one 291, compound 17, source_anomaly 1, unresolved 0 |
| alignment_status breakdown | auto_verified 5742, cross_verified 440, human_verified 57 |
| mapping_confidence breakdown | auto 5839, cross_verified 477, human_verified 80 |
| canonical Arabic fingerprint (unchanged) | `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b` |
| Pickthall fingerprint (unchanged) | `501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` |

## 8. Procedure — 7 explicit, separately-checkpointed steps

Never combine steps into one opaque operation. Confirm each step's output before proceeding to the next.

1. **Schema migration.** Run `supabase db push --linked` (applies only the one pending migration; confirm via dry-run first if available). Capture full CLI output.
2. **Schema post-validation.** Independently re-query production: confirm both tables now exist (via a real `SELECT *`, not a HEAD/count request — see §11 methodological note), confirm exactly 1 new `content_sources` row with the expected id/edition_identifier, confirm 0 rows in both new tables.
3. **Import preflight.** Run `import_production_kazimirski.py` in its dry-run/preflight mode (whatever the script exposes short of writing) against production, pointed at the frozen artifact. Confirm it reports idempotency state A (fresh) and reports the artifact hashes matching §4 exactly.
4. **Atomic import.** Run `import_production_kazimirski.py` for real (single transaction, batched). Capture full output including the transaction commit confirmation.
5. **Post-import validator.** Run `validate_kazimirski_import.py` (21 checks) against production. Require all 21 to PASS.
6. **Canonical/Pickthall comparison.** Re-run the canonical Arabic and Pickthall fingerprint queries against production; both must match §7 exactly (proves the import touched nothing outside the two new tables and the one new source row).
7. **GO/ROLLBACK decision.** Only if steps 2–6 all pass exactly as expected: mark complete, update `content_sources.verification_status` per design if that's a separate manual step, and stop — do not chain into any further work automatically. If ANY step deviates: proceed to §10 rollback, do not attempt to patch forward.

## 9. STOP conditions (any one of these halts the entire procedure, no override flag exists)

- Production project ref does not match `wubzdnuwrhmrodwqkicg`.
- Any artifact hash (full-file, canonical_payload, raw_source, aggregate_segment_text, manifest) does not match §4.
- `supabase migration list --linked` shows more than one pending migration, or a different migration id than `20260912100000_...`.
- Either target table already exists before step 1 runs.
- A `content_sources` row for `kazimirski-1869-segments-v1` or id `f8443b10-3cc8-59ee-954f-5b1129c1cec4` already exists before step 1 runs.
- The importer reports any idempotency state other than A before the real import (step 4) runs — including state F (deprecated/recovery), which requires the explicit, separately-authorized `--recover-after-rollback` path, never a blind retry.
- The validator (step 5) reports fewer than 21/21 passing.
- The canonical Arabic or Pickthall fingerprint changes at all post-import.
- Any unexpected row appears in `content_sources`, `translation_segments`, or `translation_segment_ayahs` beyond the exact expected set.

## 10. Rollback plan — two scenarios

**Scenario A: schema applied, import not yet run (failure in steps 1–3).**
Nothing to roll back at the data level — `translation_segments`/`translation_segment_ayahs` are empty. Options: leave the schema in place (harmless, empty tables + one candidate content_sources row) and retry the import once the blocking issue is fixed, or explicitly reverse the migration if the schema itself must be removed (out of scope for this runbook — would need its own down-migration, not yet written, since Option A design deliberately did not include one; treat schema-level reversal as a separate, explicitly-authorized action).

**Scenario B: import ran, post-import validation failed (failure in steps 4–6).**
Run `rollback_kazimirski.py` against production, scoped to `edition_identifier='kazimirski-1869-segments-v1'`. This deletes all segments and joins under that source and sets `content_sources.verification_status='deprecated'` (never deletes the content_sources row). Independently re-verify afterward: 0 segments, 0 joins, source row present with `verification_status='deprecated'`, canonical Arabic and Pickthall fingerprints unchanged, `fr.hamidullah-crf` and all other existing sources untouched.

**Post-rollback re-import.** The source is now in state F (deterministic id, `deprecated`, zero rows). A normal import run will correctly refuse and report state F. Re-import requires the explicit `--recover-after-rollback` flag, which re-checks all 9 eligibility conditions (id match, edition_identifier match, full provenance-field match, zero segments, zero joins, status exactly `deprecated`, no other divergent fields, artifact hashes match §4, explicit flag present) inside one transaction alongside the reactivation + full import — never a blind retry, never an upsert.

## 11. Methodological note — HEAD-request false positive

`.select("id", {count:"exact", head:true})` against PostgREST returns an identical `{success:true, status:204}` response whether or not the target table exists. Do not use this method to check table existence at any step in this runbook. Use a plain non-head `SELECT *`, which correctly returns `PGRST205` for a genuinely absent table. This was independently proven during preflight via a deliberately-nonexistent control table name.

## 12. Evidence to capture during execution

Full stdout/stderr of each of the 7 steps; the exact git commit hash at execution time; the exact artifact file hash used; timestamps of each step; the validator's full 21-check output; before/after row counts for all touched tables; before/after canonical Arabic and Pickthall fingerprints; the final idempotency state reported by the importer.

## 13. Explicit non-goals of this runbook

This runbook does not authorize execution. Producing or reading it does not constitute running `supabase db push --linked`, running the importer, or deploying. Execution requires a separate, explicit authorization gate.
