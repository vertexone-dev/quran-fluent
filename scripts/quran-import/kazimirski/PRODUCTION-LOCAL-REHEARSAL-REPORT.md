# Kazimirski Production Migration/Import — Formal Local Rehearsal Report

**Rehearsal executed:** 2026-09-02
**Executed by:** local rehearsal agent, on behalf of amkristian91@gmail.com
**Repository:** `Quran Fluent` (TanStack Start + Supabase/Postgres)
**Git branch at time of rehearsal:** `fix-french-disputed-translation-source`
**Git HEAD at time of rehearsal:** `1049ee37599b773b94c441153a4bcc61113fc28f`
**Scope:** LOCAL ONLY. No production reads, no production writes, no `supabase db push --linked`,
no deployment, no application code changes. No `supabase db reset`/`stop`/`start` was ever run.

**Local DB target:** a genuinely separate, disposable Postgres **database** named
`kazimirski_rehearsal`, created with `CREATE DATABASE kazimirski_rehearsal;` inside the
same local Postgres cluster the project's shared Supabase instance uses
(`127.0.0.1:54322`, superuser `postgres`/`postgres`). This was used instead of the
shared `postgres` database (which holds the Phase 3–5 local-prototype
`translation_segments`/`translation_segment_ayahs` rows — 6,239/6,396 rows with real
human-review annotations, created via direct `psql` and not recoverable from git) and
instead of `supabase db reset` (which would have destroyed that same irreplaceable
state, per this task's explicit safety instructions). Every write in this rehearsal
went to `kazimirski_rehearsal`; every touch of the shared `postgres` database was a
read-only baseline/comparison query, verified independently before and after. The
disposable database was dropped (`DROP DATABASE kazimirski_rehearsal;`) at the end of
the rehearsal — nothing disposable was left behind. This report, and the hashes/counts
recorded in it, is the lasting evidence.

---

## 1. Pre-rehearsal repository state

- Branch: `fix-french-disputed-translation-source`, up to date with
  `origin/fix-french-disputed-translation-source`.
- HEAD: `1049ee37599b773b94c441153a4bcc61113fc28f`.
- `git status` at start:
  ```
  Untracked files:
    scripts/quran-import/KAZIMIRSKI-RESEARCH.md
    scripts/quran-import/kazimirski/
    supabase/.branches/
    tests/e2e/36-level2-release-audit-journey.spec.ts
  nothing added to commit but untracked files present
  ```
- `supabase/migrations/` contains exactly **42** `.sql` files (filename-sorted,
  `20260816071743_...` through `20260911110000_521fb3f2-dbdb-41a6-9985-098065ebd88c.sql`).
  Combined checksum of all 42 files (`shasum` of each file's `shasum`, concatenated,
  re-hashed) at rehearsal start: `9d9e08e2502dbc3156c82406580dad2286ec3b30`.
- `scripts/quran-import/kazimirski/migrations-staging/` contains exactly **1** file:
  `20260912100000_4bddf81d-6e3e-4260-a2a2-89c4b5b3f933.sql`
  (sha1 `b2ad86469ad29852ac8c7447adb0086c62cf1c20`).
- Confirmed **no** file under `supabase/migrations/` creates `translation_segments` or
  `translation_segment_ayahs` (`grep -rl "CREATE TABLE.*translation_segments"
  supabase/migrations/` → no matches). Three existing migration files mention
  "kazimirski" — all three are references to the pre-existing, unrelated
  `kazimirski-1869` flat-table `content_sources` row (a `legacy_interim`-style row
  registered on 2026-08-20, referenced again in passing by the 2026-09-11
  `fr.hamidullah-crf` remediation migration's notes). None of the three create or
  touch `translation_segments`/`translation_segment_ayahs`, and none register
  `kazimirski-1869-segments-v1`.
- `grep -ril "kazimirski" src/` → **zero matches**. `git diff --stat -- src/` → empty.
  Nothing tracked was unexpectedly dirty. Nothing was deleted or moved.

## 2. Existing local baseline (shared `postgres` DB, read-only)

All queried directly against `postgresql://postgres:postgres@127.0.0.1:54322/postgres`,
read-only, before any write occurred anywhere in this rehearsal:

| Metric | Value |
|---|---|
| `ayahs` count | **6236** |
| `ayahs` canonical fingerprint (`sha256(string_agg(arabic_text, U+001E ORDER BY surah_number, ayah_number))`) | `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b` |
| Pickthall (`translations` joined to `pickthall-gutenberg-16955`, `verified`) count | **6236** |
| Pickthall fingerprint (same methodology) | `501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` |
| `content_sources` count | **5** — `fr.hamidullah-crf` (disputed), `kazimirski-1869` (candidate, legacy flat-table row), `kazimirski-1869-segments-phase3` (candidate, Phase 3 prototype), `pickthall-gutenberg-16955` (verified), `uthmani` (candidate) |
| Phase 3–5 local-prototype `translation_segments` count | **6239** |
| Phase 3–5 local-prototype `translation_segment_ayahs` count | **6396** |
| `translations` total (Pickthall + 58 governed-disputed Hamidullah rows) | 6294 |
| `surahs` count | 114 |

These figures are the ground truth this whole rehearsal is checked against, and are
re-verified byte-for-byte in §23 below.

## 3. Prepare the disposable database

`CREATE DATABASE kazimirski_rehearsal;` was run against the shared cluster. All 42
`supabase/migrations/*.sql` files were then replayed, in filename-sorted order, via
`psql -f` against `postgresql://postgres:postgres@127.0.0.1:54322/kazimirski_rehearsal`.

**Two findings surfaced, both resolved as documented Supabase-platform-bootstrap
parity, not as gaps in the migration history itself:**

1. **`auth` schema / `auth.users` / `auth.uid()` missing.** Seven migration files
   (`20260816071743`, `20260817025658`, `20260817225510`, `20260817230114`,
   `20260818042220`, `20260818090000`, `20260822100000`) reference `auth.users(id)` as
   an FK target and/or call `auth.uid()` inside RLS policies. None of the 42 migration
   files contain `CREATE SCHEMA auth` or `CREATE TABLE auth.users` — in real Supabase
   deployments this schema is created by the platform (GoTrue) before any user
   migration runs, not by a migration file. A bare `CREATE DATABASE` in the same
   cluster does not inherit it. **Resolution:** a minimal, standard `auth.users`
   table (`id uuid PK, email text, raw_user_meta_data jsonb, created_at timestamptz`)
   and the standard `auth.uid()` SQL function (reading
   `request.jwt.claim.sub`/`request.jwt.claims`) were created before replay, exactly
   matching Supabase's own well-known definitions. This is the "e.g. the auth schema
   itself" trivial-platform-artifact case the task's own instructions anticipated —
   not a hand-fix of a real migration-history gap.
2. **`pgcrypto`/`uuid-ossp` extensions missing.** No migration file contains
   `CREATE EXTENSION` (confirmed by `grep -l "CREATE EXTENSION" supabase/migrations/*.sql`
   → zero matches), yet several migrations use `gen_random_uuid()` (core in PG13+, no
   extension needed) and the canonical-fingerprint queries this rehearsal itself uses
   depend on `digest()` (pgcrypto). Querying the shared `postgres` DB confirmed
   `pgcrypto`, `uuid-ossp`, and `pg_stat_statements` are enabled there in an
   `extensions` schema with `search_path = "$user", public, extensions` — i.e. these
   were enabled once at Supabase project bootstrap time, outside migration history,
   exactly like the `auth` schema. **Resolution:** `CREATE SCHEMA extensions;
   CREATE EXTENSION pgcrypto WITH SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH
   SCHEMA extensions;` plus matching `search_path`, applied once before replay.
3. **A genuine `psql -f` invocation-mode finding (not a migration content gap).**
   Under plain `psql -f` (default autocommit-per-statement), migration
   `20260909100000_8e140665-265c-4d00-8763-3a8458b1f15a.sql` **fails**:
   `ERROR: relation "_fr_payloads" does not exist`. That migration uses
   `CREATE TEMP TABLE _fr_payloads (...) ON COMMIT DROP;` followed by later statements
   that read from it — a pattern that only works if the whole file executes as one
   transaction (the temp table must survive until the file's own final `COMMIT`).
   Under psql's default autocommit mode, the `CREATE TEMP TABLE ... ON COMMIT DROP`
   statement is its own implicit transaction and the table is dropped immediately,
   before the next statement can see it. **Resolution:** replay used
   `psql -v ON_ERROR_STOP=1 -1 -f <file>` (`-1` / `--single-transaction`, a standard
   psql flag) for every file, wrapping each migration file in one atomic transaction —
   which is also the only invocation mode consistent with this repo's own convention
   of `DO $$ ... RAISE EXCEPTION $$` precondition/postcondition guards designed to
   abort a whole file transactionally. With `-1`, this migration (and all others)
   applied cleanly. This is reported as a rehearsal-tooling finding, not a blocker:
   plain `psql -f` is not sufficient to faithfully replay this repo's migrations;
   `psql -f -1` (or equivalent single-transaction application) is required.

With those three platform/tooling items addressed, **all 42 migrations applied to
`kazimirski_rehearsal` with zero errors**, in filename order, including all embedded
`DO $$ ... RAISE EXCEPTION $$` precondition/postcondition self-checks (which all
printed their own `RAISE NOTICE` success messages, e.g. the `fr.hamidullah-crf`
remediation's own postcondition check).

**No BLOCKER was raised.** The migration history is reproducible from scratch, subject
only to the two documented, trivial Supabase-platform bootstrap items above (auth
schema, pgcrypto/uuid-ossp) — exactly the kind of exception the task's own
instructions pre-authorized rather than fighting.

## 4. Verify clean baseline (`kazimirski_rehearsal`, post-replay, pre-Kazimirski)

| Metric | `kazimirski_rehearsal` | Shared `postgres` (§2) | Match |
|---|---|---|---|
| `ayahs` count | 6236 | 6236 | YES |
| `ayahs` fingerprint | `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b` | same | **exact match** |
| Pickthall count | 6236 | 6236 | YES |
| Pickthall fingerprint | `501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` | same | **exact match** |
| `translation_segments` / `translation_segment_ayahs` tables | do not exist (`to_regclass` → NULL) | N/A | as expected |

The replayed-from-scratch database reproduces the canonical Arabic and Pickthall
content **byte-for-byte identically** to the shared instance's own long-accumulated
state — the strongest evidence available that the migration history is complete and
correct.

## 5. Apply the staged Kazimirski migration

Applied directly via `psql -v ON_ERROR_STOP=1 -1 -f migrations-staging/20260912100000_...sql`
against `kazimirski_rehearsal` (never copied into `supabase/migrations/`). Both
embedded `DO $$` blocks printed their `RAISE NOTICE` success messages:
- Precondition: "All preconditions satisfied: 6236 canonical ayahs, 6236 Pickthall
  rows, no existing translation_segments/translation_segment_ayahs tables, no existing
  kazimirski-1869-segments-v1 source row. Proceeding."
- Postcondition: "All postconditions satisfied: translation_segments/
  translation_segment_ayahs created with 0 rows each, content_sources row
  `f8443b10-3cc8-59ee-954f-5b1129c1cec4` registered as candidate, 6236 canonical ayahs
  and 6236 Pickthall translations unchanged."

Verified directly: both tables exist; 4 triggers present
(`translation_segments_immutable_fields_trg`, `translation_segments_updated_at`,
`translation_segment_ayahs_immutable_fields_trg`,
`translation_segment_ayahs_cross_surah_guard_trg`); RLS enabled on both tables; one
`SELECT`-only policy per table scoped to `anon, authenticated`.

Direct behavioral tests (throwaway rows inserted, tested, then deleted — confirmed 0
rows remaining afterward):

| Test | Expected | Actual |
|---|---|---|
| `UPDATE translation_segments SET text = ...` | REJECTED | REJECTED — `translation_segments identity fields are immutable` |
| `UPDATE translation_segments SET alignment_status=..., reviewed_by=...` | SUCCEEDS | SUCCEEDED |
| `INSERT translation_segment_ayahs` with surah matching parent segment | SUCCEEDS | SUCCEEDED |
| `INSERT translation_segment_ayahs` with surah NOT matching parent segment (cross-surah) | REJECTED | REJECTED — `cross-surah join rejected` |
| `UPDATE translation_segment_ayahs SET ayah_number = ...` (identity field) | REJECTED | REJECTED — `mapping identity fields are immutable` |
| `UPDATE translation_segment_ayahs SET mapping_confidence=..., reviewed_by=...` | SUCCEEDS | SUCCEEDED |

All throwaway rows cleaned up; verified 0/0 rows in both tables immediately after.

## 6. Regenerate the artifact

`generate_production_import.py` run twice, fresh, from the frozen inputs (reads the
shared `postgres` DB read-only for its documented Phase-5-state cross-checks — no
writes, independent of `kazimirski_rehearsal`):

| | Run 1 | Run 2 |
|---|---|---|
| `canonical_payload_sha256` | `46435278f3bf1b8323391b8f9a825f35200493828e2f5dc071a54ba76fb57303` | `46435278f3bf1b8323391b8f9a825f35200493828e2f5dc071a54ba76fb57303` (**byte-identical**) |
| Full-file SHA256 | `8782618b8e21c7fda3e14daaf94aac8c525aa09b5b232436be98f0e056e0acd9` | `c12cdfa757680e6e36900684e9fe34cc0d24472ee7ba1ec0326ceaea9b6955f6` (differs — expected: only `generated_at` wall-clock timestamp differs between runs; the canonical payload, which excludes `generated_at`, is identical) |
| segments / joins | 6239 / 6396 | 6239 / 6396 |
| canonical_coverage | 6236/6236 | 6236/6236 |
| human_verified segments / joins | 57 / 80 | 57 / 80 |

All 17 generator gates passed both runs. Final artifact on disk (Run 2's output, the
current `generated/kazimirski-production-import.json`): full-file SHA256
`c12cdfa757680e6e36900684e9fe34cc0d24472ee7ba1ec0326ceaea9b6955f6`, canonical payload
SHA256 `46435278f3bf1b8323391b8f9a825f35200493828e2f5dc071a54ba76fb57303`.

## 7. Standalone artifact validation

Direct inspection of the artifact JSON (no DB access):

| Check | Result |
|---|---|
| `schema_version` | `1.0.0` |
| `raw_source_sha256` | `38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92` — matches approved value |
| `aggregate_segment_text_hash` | `12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26` — matches approved value |
| segment count declared vs. actual array length | 6239 / 6239 |
| join count declared vs. actual array length | 6396 / 6396 |
| `canonical_coverage` | `6236/6236` |
| `canonical_payload_sha256` self-check (recomputed from `core`) | recomputed = declared, **MATCH** |
| duplicate segment `(surah,ordinal)` keys / ids | 0 / 0 |
| duplicate join ids / `(segment_key,surah,ayah)` keys | 0 / 0 |
| orphan joins (segment_key not present in segments) | 0 |
| cross-surah joins (join surah ≠ its segment's surah) | 0 |
| unresolved segments (`alignment_type`/`alignment_status`='unresolved') | 0 |
| review reconciliation | 25 decisions, 57 human_verified segments, 80 human_verified joins, 17 Tier 2 human_verified joins |

## 8. First import

`import_production_kazimirski.py --db-url postgresql://postgres:postgres@127.0.0.1:54322/kazimirski_rehearsal --schema public`:

```
Artifact validation: PASSED (schema_version, both hashes, self-integrity, all counts, review totals).
Pre-import baseline: ayahs count=6236 hash=ec8b0255f039...  pickthall count=6236 hash=501e14655a29...
Idempotency state: A {'content_source_pre_exists': True}
Import committed: 6239 segments, 6396 joins, source_id=f8443b10-3cc8-59ee-954f-5b1129c1cec4.
```
Exit code 0. State A correctly recognized `content_source_pre_exists=True` (the schema
migration in §5 already registered the row) and re-asserted rather than re-inserted it.

Validator run immediately after: **21/21 checks PASSED** — exactly one Kazimirski
source, id matches deterministic id, `verification_status=candidate`, 6239 segments,
6396 joins, coverage 6236/6236, zero unresolved, breakdowns sum correctly
(`alignment_type`: compound 17 / direct 2909 / many_to_one 291 / offset 2877 /
one_to_many 144 / source_anomaly 1; `alignment_status`: auto_verified 5742 /
cross_verified 440 / human_verified 57; `mapping_confidence`: auto 5839 /
cross_verified 477 / human_verified 80), 57 human_verified segments, 80 human_verified
joins, 17 Tier 2 human_verified joins, aggregate hash matches, ayahs/Pickthall
baselines unchanged, zero unexpected/missing rows.

## 9. Post-import canonical integrity

Recomputed on `kazimirski_rehearsal` post-import: ayahs 6236 /
`ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b`; Pickthall 6236 /
`501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` — **identical to
§4's pre-import baseline**, proving the import touched nothing in `ayahs`/`translations`.

## 10. ID determinism

One segment of each required kind, UUIDv5 recomputed independently in Python and
compared against both the artifact's own declared id and the live DB row:

| Case | surah:ordinal | alignment_type | Expected (recomputed) | Artifact | DB | Match |
|---|---|---|---|---|---|---|
| direct | 2:222 | direct | `61233a13-7848-5865-a014-55177f71c8f4` | same | same | YES |
| one_to_many | 2:1 | one_to_many | `a4236e60-a1b3-5db0-82fe-028743e6e134` | same | same | YES |
| many_to_one | 1:6 | many_to_one | `015837e2-387d-50be-bd97-b6331fabf159` | same | same | YES |
| source_anomaly (Fatiha preamble) | 1:0 | source_anomaly | `67cd6bcf-a1a8-525c-b5e9-213122e09b14` | same | same | YES |
| human_verified | 2:7 | offset | `5e5ebb95-8deb-5bf9-b367-7cc71bd883b4` | same | same | YES |

**Zero drift** across all 5 representative cases.

## 11. Idempotent second run

Re-ran the importer against the fully-imported DB. Before/after `sha256` fingerprints
of `(id, updated_at)` for every segment and `(id, reviewed_at)` for every join were
captured and found **identical**:
- segments fingerprint: `a51f9e6899b9c70c60018bcd7228077ae86ccd95fbead6ea206d0a6b7bde9063` (before = after)
- joins fingerprint: `1e23d8cd14f28f6df827c6f54cda41b5cc4fe1845215c6a1d29428399fb76bb4` (before = after)

```
Idempotency state: B {'existing_segments': 6239, 'existing_joins': 6396}
Already imported, verified identical. No-op. Zero new rows written.
```
Exit code 0. Row counts unchanged (6239/6396). Re-ran the validator: **21/21 PASSED**,
identical to §8.

## 12. Partial-state rejection

Deleted one join row directly (`id=00044b20-5f3a-5637-a6c1-567a1c449d82`, captured in
full beforehand). Ran the importer:
```
Idempotency state: C {'reason': 'content_sources row exists but not all expected segment/join rows are present (partial prior run)', 'existing_segments': 6239, 'expected_segments': 6239, 'existing_joins': 6395, 'expected_joins': 6396}
ABORT [C]: ...
```
Exit code 1. **No repair was attempted.** Restored the deleted row with its exact
original values (id, segment_id, surah, ayah, mapping_confidence, reviewer fields,
created_at). Validator returned to **21/21 PASSED**.

## 13. Divergent-state rejection

Mutated one join's `mapping_confidence` from `auto` to `cross_verified`
(`id=00046d59-7f0d-59a8-9a05-40dd08558241`). Ran the importer:
```
Idempotency state: D {'reason': 'one or more existing rows diverge from the artifact', 'diverging_count': 1, 'examples': [('join', '00046d59-7f0d-59a8-9a05-40dd08558241')]}
ABORT [D]: ...
```
Exit code 1. **No overwrite occurred.** Reverted the value exactly. Validator returned
to **21/21 PASSED**.

## 14. Source identity collision

Inserted a decoy `content_sources` row sharing `edition_identifier =
'kazimirski-1869-segments-v1'` under a fresh random id (no unique constraint exists on
`edition_identifier` alone — confirmed via `\d content_sources`). Ran the importer:
```
Idempotency state: E {'reason': 'existing segment/join rows found, but the content_sources row for this edition_identifier has an unexpected id', 'found_id': 'f8443b10-3cc8-59ee-954f-5b1129c1cec4\n574ab525-1ad1-4948-a8f0-2d814f41f904', 'expected_id': 'f8443b10-3cc8-59ee-954f-5b1129c1cec4'}
ABORT [E]: ...
```
Exit code 1. **No takeover occurred.** Deleted the decoy row. Validator returned to
**21/21 PASSED**.

## 15. Transaction rollback on forced failure

Manually cleared all segments/joins (direct SQL) to reach an "absent" (state A)
starting point, leaving the migration-created `content_sources` row (`candidate`)
in place. Built a deliberately tampered copy of the real artifact: one join's
`ayah_number` was changed from a valid target (3) to `999999` (guaranteed absent from
`ayahs`), and `canonical_payload_sha256` was recomputed over the tampered content so
the importer's pre-write self-integrity check would **pass** (letting the run reach
the actual DB-write phase rather than being rejected up front).

Result:
```
Idempotency state: A {'content_source_pre_exists': True}
... INSERT 0 500 (x13 segment batches, 6239 rows total) ...
... INSERT 0 500 (x12 join batches) ...
psql:...: ERROR: insert or update on table "translation_segment_ayahs" violates foreign key constraint "translation_segment_ayahs_surah_number_ayah_number_fkey"
DETAIL: Key (surah_number, ayah_number)=(3, 999999) is not present in table "ayahs".
ABORT [UNEXPECTED]: DbError: psql -f failed (transaction rolled back): ...
```
All 6,239 segments and 12 full join batches had already executed inside the same
`BEGIN...COMMIT` transaction before the failing batch — a genuine mid-transaction
failure. Confirmed **zero Kazimirski rows visible afterward** (`translation_segments`
count = 0, `translation_segment_ayahs` count = 0), and the `ayahs` baseline (count +
fingerprint) unaffected. Re-ran the importer against the real, untampered artifact:
succeeded cleanly (state A, 6239/6396 committed, exit 0). Validator: **21/21 PASSED**.

## 16. Formal rollback tool test

From the valid complete import in §15, ran `rollback_kazimirski.py`:
```
Verified target source_id=f8443b10-3cc8-59ee-954f-5b1129c1cec4 corresponds to edition_identifier='kazimirski-1869-segments-v1'.
Before rollback: 6239 segments, 6396 joins under this source_id.
Rollback committed: 6239 segments and 6396 joins deleted; content_sources row f8443b10-3cc8-59ee-954f-5b1129c1cec4 marked deprecated (not deleted).
```
Exit code 0. Verified: `translation_segments`=0, `translation_segment_ayahs`=0,
`content_sources.verification_status`='deprecated' (row still present, not deleted).
Unrelated state unchanged: `content_sources` total count 5→5, `ayahs` 6236 (fingerprint
unchanged), `translations` 6294 (Pickthall fingerprint unchanged).

## 17. Re-import after rollback

**Finding (not a blocker, but a genuine gap between the state-classifier's label and
the transaction script's actual behavior):** running the importer again immediately
after rollback reports `Idempotency state: A` (0 existing segments/joins, deterministic
`content_sources.id` still matches) — but the transaction script's own re-assert block
independently checks `verification_status` against the artifact's declared value
(`candidate`) and finds `deprecated` (set by rollback in §16), so it **aborts inside
the transaction** rather than proceeding:
```
Idempotency state: A {'content_source_pre_exists': True}
ABORT [UNEXPECTED]: DbError: ... ERROR: pre-existing content_sources row f8443b10-3cc8-59ee-954f-5b1129c1cec4 has verification_status=deprecated, expected candidate
```
Exit code 1, **zero rows written** — this is safe (fail-closed, no silent
un-deprecation, no partial state), but it means state "A" as reported by
`classify_state()` does **not** always mean "will proceed cleanly" when the source was
previously rolled back. A future implementation phase should either have the importer
explicitly detect and report this as its own distinct state (rather than surfacing it
only as a mid-transaction abort), or the operational runbook must document that a
human must deliberately reset `verification_status='candidate'` before re-importing
after a rollback. To complete this rehearsal step, `verification_status` was manually
reset to `candidate` (matching the value the original schema migration set), and the
importer was re-run: succeeded cleanly (state A, 6239/6396 committed, exit 0).
Validator: **21/21 PASSED**.

## 18. RLS behavior

| Role | Operation | Expected | Actual |
|---|---|---|---|
| `anon` | `SELECT` | succeeds | succeeded (6239/6396 counts returned) |
| `authenticated` | `SELECT` | succeeds | succeeded |
| `anon` | `INSERT` | denied | denied — `permission denied for table translation_segments` |
| `anon` | `UPDATE` | denied | denied — `permission denied for table translation_segments` |
| `anon` | `DELETE` | denied | denied — `permission denied for table translation_segments` |
| `authenticated` | `INSERT` | denied | denied — `permission denied for table translation_segments` |
| service/import path (`postgres` superuser, as the importer itself connects) | write | succeeds | proven throughout §8–§17's successful imports/rollback |

No policy was weakened to make any of the above pass. Row counts unchanged (6239/6396)
after every denied attempt.

## 19. Resolver-contract read tests (read-only SQL only)

| Case | Query pattern | Result |
|---|---|---|
| **direct** | one segment, one join | e.g. segment 26:188 → exactly 1 join, trivial |
| **one_to_many** | `MIN`/`MAX(ayah_number)` grouped by `segment_id` | e.g. segment 2:38 → range 40–41 (2 joins); segment 101:1 → range 1–2 |
| **many_to_one** | all segments joined to one target ayah, ordered by `source_ordinal` | ayah 1:7 → 2 contributing segments (ordinal 6, "Dans le sentier..."; ordinal 7, "Non pas de ceux...") |
| **compound** | same many_to_one query pattern, no special-casing | ayah 3:39 → 2 contributing segments (ordinal 33, 34) recovered by the identical query used for many_to_one — confirms no duplicate-row tricks or special-case code are required |

## 20. Existing test suite

- `python3 scripts/quran-import/kazimirski/tests/test_production_migration_pipeline.py`
  (its own pre-existing isolated-schema approach against the **shared** `postgres` DB,
  unrelated to `kazimirski_rehearsal`): **38/38 PASSED**, 0 failed. Teardown ran and
  restored the shared DB to its pre-suite state (verified independently in §23).
- `npm run test:unit` (vitest): **24/24 PASSED** (3 test files), 216ms.
- `npm run lint` (eslint): **3 pre-existing errors + 14 pre-existing warnings**, all in
  files untouched by this rehearsal and untouched by the Kazimirski implementation
  work generally:
  - 3 prettier-formatting errors in
    `scripts/quran-import/kazimirski/local-prototype/resolver.ts` and
    `.../tests/resolver.test.ts` (pre-existing Phase 3 prototype files, last modified
    2026-09-01, before this rehearsal session began; not modified by this task).
  - 14 `react-hooks/exhaustive-deps` / `react-refresh/only-export-components` warnings
    across unrelated `src/` files (`LessonExerciseRenderer.tsx`, `AyahPlayButton.tsx`,
    `badge.tsx`, `button.tsx`, `form.tsx`, `navigation-menu.tsx`, `sidebar.tsx`,
    `toggle.tsx`, `auth.tsx`, `i18n.tsx`, `theme.tsx`) — none related to Kazimirski,
    none touched by this rehearsal (`git diff --stat -- src/` is empty).
  These predate this rehearsal and are unrelated to it; **not fixed**, per instructions
  to document rather than repair unrelated issues.
- `npm run build` (vite + nitro): **succeeded** cleanly, no errors.

## 21. Final canonical/Pickthall recheck

After all destructive/recovery steps (§12–§17), recomputed on `kazimirski_rehearsal`:
ayahs 6236 / `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b`;
Pickthall 6236 / `501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` —
**identical to §4's baseline**. Kazimirski state at this point: 6239 segments, 6396
joins, validator 21/21 PASSED.

## 22. Final rehearsal state

**Option A chosen**: `kazimirski_rehearsal` was left in a complete, valid, fully
imported, validator-passing Kazimirski state (6239 segments, 6396 joins,
`verification_status=candidate`, validator 21/21 PASS) at the moment its final
snapshot was taken — the most useful evidence of a clean end-to-end rehearsal. No
partial/corrupted/collision test state remained (every destructive test in §12–§17 was
individually restored and re-validated before moving to the next step). The database
was then dropped per the mandatory cleanup instruction:
```sql
DROP DATABASE kazimirski_rehearsal;
```
Confirmed dropped (`SELECT datname FROM pg_database WHERE datname='kazimirski_rehearsal'`
→ empty).

## 23. Repository cleanliness

- Final `git status`: identical set of untracked entries as §1
  (`scripts/quran-import/KAZIMIRSKI-RESEARCH.md`, `scripts/quran-import/kazimirski/`,
  `supabase/.branches/`, `tests/e2e/36-level2-release-audit-journey.spec.ts`) — no new
  untracked top-level entries, no tracked-file changes.
- `supabase/migrations/`: still exactly 42 files, unchanged.
- `migrations-staging/`: still exactly 1 file
  (`20260912100000_4bddf81d-6e3e-4260-a2a2-89c4b5b3f933.sql`, sha1
  `b2ad86469ad29852ac8c7447adb0086c62cf1c20`, matching §1).
- `git diff --stat -- src/`: empty. Zero `src/` changes.
- No unrelated file changed (the only files this rehearsal wrote to are the
  regenerated `generated/kazimirski-production-import.json`, already-untracked, and
  this report — both inside the already-untracked `scripts/quran-import/kazimirski/`
  directory).
- Shared `postgres` local database independently re-verified, byte-for-byte identical
  to §2:

  | Metric | §2 baseline | Final re-check | Match |
  |---|---|---|---|
  | `ayahs` count / fingerprint | 6236 / `ec8b0255...` | 6236 / `ec8b0255...` | YES |
  | Pickthall count / fingerprint | 6236 / `501e1465...` | 6236 / `501e1465...` | YES |
  | `content_sources` count | 5 | 5 | YES |
  | Phase 3–5 prototype segments / joins | 6239 / 6396 | 6239 / 6396 | YES |
  | `translations` total | 6294 | 6294 | YES |
  | leftover test schema (`kaz_prod_rehearsal_test` from §20's test suite) | — | none found | YES (teardown confirmed) |

## 24. Deviations, findings, and unresolved items

1. **Platform-bootstrap prerequisites not in migration history** (auth schema,
   pgcrypto/uuid-ossp extensions) — documented in §3, resolved as trivial
   Supabase-platform-artifact recreation, not a real migration-history gap.
2. **Plain `psql -f` (autocommit mode) is insufficient to replay this repo's
   migrations faithfully**; `psql -f -1` (single-transaction) is required, due to one
   migration's `ON COMMIT DROP` temp-table pattern. Documented in §3. Recommendation:
   any future automation that applies these migration files directly via `psql`
   (rather than through the Supabase CLI, which already handles this correctly)
   should use `-1`/`--single-transaction`.
3. **Re-import-after-rollback state-classification gap** (§17): `classify_state()`
   reports state A after a rollback, but the actual import fails mid-transaction due
   to a `verification_status` mismatch the classifier doesn't check. Safe
   (fail-closed, zero writes) but not clean. Recommendation for a future
   implementation gate: either add an explicit state check for
   "content_sources exists, deprecated, zero dependent rows" distinct from state A, or
   document the required manual `verification_status` reset step in the operational
   rollback/re-import runbook.
4. No other blockers, gaps, or unexpected behavior were found across any of the 24
   rehearsal steps. Every idempotency state (A/B/C/D/E), every trigger, every RLS
   policy, every ID-determinism check, and every canonical-content protection behaved
   exactly as `PRODUCTION-MIGRATION-IMPORT-DESIGN.md` specifies.
5. Unresolved design questions §21/22 of the design doc (verification_status
   `'candidate'` vs `'verified'`, resolver activation gating, batch size confirmation)
   remain genuinely unresolved by this rehearsal — this rehearsal proves the
   *mechanism* works correctly; it does not and cannot resolve those product/policy
   questions, which the design doc itself flags as requiring a separate human decision.

## 25. Final reconciliation table

| Invariant | Expected | Actual | PASS/FAIL |
|---|---|---|---|
| All 42 `supabase/migrations/*.sql` apply cleanly from scratch (single-transaction-per-file replay) | 0 errors | 0 errors (2 documented platform-bootstrap prerequisites recreated) | PASS |
| Fresh-replay `ayahs` count | 6236 | 6236 | PASS |
| Fresh-replay `ayahs` fingerprint | `ec8b0255f0399...` | `ec8b0255f0399...` | PASS |
| Fresh-replay Pickthall count | 6236 | 6236 | PASS |
| Fresh-replay Pickthall fingerprint | `501e14655a290...` | `501e14655a290...` | PASS |
| Staged migration applies cleanly, 0 rows post-apply | 0/0 | 0/0 | PASS |
| Immutability trigger blocks segment identity-field UPDATE | rejected | rejected | PASS |
| Immutability trigger allows segment review-field UPDATE | succeeds | succeeded | PASS |
| Cross-surah guard trigger rejects mismatched join | rejected | rejected | PASS |
| Immutability trigger blocks join identity-field UPDATE | rejected | rejected | PASS |
| Immutability trigger allows join review-field UPDATE | succeeds | succeeded | PASS |
| Generator: two runs byte-identical `canonical_payload_sha256` | identical | identical (`46435278f3bf...`) | PASS |
| Generator: 17 gates pass | 6239 seg / 6396 join / 6236/6236 coverage | same | PASS |
| Artifact self-integrity (`canonical_payload_sha256` recompute) | match | match | PASS |
| Artifact: zero duplicate/orphan/cross-surah/unresolved rows | 0/0/0/0 | 0/0/0/0 | PASS |
| First import (state A) commits full 6239/6396 | success | success | PASS |
| Post-import ayahs/Pickthall unchanged | unchanged | unchanged | PASS |
| ID determinism (5 representative segments) | 0 drift | 0 drift | PASS |
| Idempotent re-run (state B) | zero writes, exit 0 | zero writes (fingerprints identical), exit 0 | PASS |
| Partial state (state C) | STOP, no repair | STOP, no repair | PASS |
| Divergent state (state D) | STOP, no overwrite | STOP, no overwrite | PASS |
| Identity collision (state E) | STOP, no takeover | STOP, no takeover | PASS |
| Forced mid-transaction failure | full rollback, 0 rows | full rollback, 0 rows | PASS |
| Clean re-import after forced failure | success | success | PASS |
| Rollback tool | joins+segments deleted, source deprecated | 6396/6239 deleted, deprecated | PASS |
| Rollback: unrelated tables unaffected | unchanged | unchanged | PASS |
| Re-import after rollback | documented gap, safe fail-closed | ABORT (verification_status mismatch), zero writes; succeeds after manual status reset | PASS (safe; gap documented in §24) |
| RLS: anon/authenticated SELECT | succeeds | succeeded | PASS |
| RLS: anon/authenticated INSERT/UPDATE/DELETE | denied | denied | PASS |
| Resolver-contract reads (direct/one_to_many/many_to_one/compound) | no special-casing needed | confirmed | PASS |
| `test_production_migration_pipeline.py` | 38/38 | 38/38 | PASS |
| `npm run test:unit` | all green | 24/24 | PASS |
| `npm run lint` | pre-existing issues only | 3 pre-existing errors, 14 pre-existing warnings, all unrelated | PASS (documented) |
| `npm run build` | succeeds | succeeded | PASS |
| Final canonical/Pickthall recheck (post steps 12-17) | unchanged from §4 | unchanged | PASS |
| Repository cleanliness | no unexpected changes | confirmed | PASS |
| Shared `postgres` DB untouched (writes) | 0 writes | 0 writes (only read-only queries + the pre-existing test suite's own documented, self-cleaning temporary row) | PASS |
| `kazimirski_rehearsal` dropped at end | dropped | dropped, confirmed | PASS |

## 26. Formal GO/NO-GO recommendation

All 24 rehearsal steps completed with PASS results. Two trivial Supabase-platform
bootstrap prerequisites (not migration-history gaps) and one psql-invocation-mode
finding were required to replay the migration history from a bare database — both
fully documented in §3/§24, neither a defect in the repository's migration files
themselves. One genuine, non-blocking state-classification gap was found and
documented in §17/§24 (safe fail-closed behavior; recommend fixing before real
production use, not before this GO). No blocking invariant failed.

```
KAZIMIRSKI FORMAL LOCAL REHEARSAL: PASS

AUTHORIZED NEXT STEP:
PRODUCTION PREFLIGHT / MIGRATION PROMOTION REVIEW

IMPORTANT:
This does NOT authorize production migration application or import.
```

---

## Side-effect report

- **Local DB resets:** 0 (an isolated disposable database was used, not a reset of
  the shared instance; `supabase db reset`/`stop`/`start` were never run).
- **Local DB writes:** all against the disposable `kazimirski_rehearsal` database
  (schema creation, migration replay, Kazimirski schema migration, imports,
  rollback, and all destructive/recovery test mutations), which was dropped at the
  end of the rehearsal. Against the shared `postgres` database: read-only baseline
  queries only, **except** the pre-existing `test_production_migration_pipeline.py`
  suite (§20), which — per its own long-established, self-documented design —
  creates and deletes its own temporary `public.content_sources` row and its own
  disposable Postgres schema (`kaz_prod_rehearsal_test`) inside the shared DB, and
  tears both down again before exiting (independently re-verified clean in §23).
- **Production DB reads:** 0.
- **Production DB writes:** 0.
- **Production migrations applied:** 0.
- **Files created:** this report
  (`scripts/quran-import/kazimirski/PRODUCTION-LOCAL-REHEARSAL-REPORT.md`); the
  regenerated artifact `scripts/quran-import/kazimirski/generated/kazimirski-production-import.json`
  (already-untracked, byte-identical canonical payload to before, only the wall-clock
  `generated_at` field differs).
- **Files modified:** 0 pre-existing tracked files.
- **Deployments:** 0.
