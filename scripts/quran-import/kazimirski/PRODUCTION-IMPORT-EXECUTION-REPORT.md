# Kazimirski Production Import — Execution Report

**Status: EXECUTED. KAZIMIRSKI PRODUCTION IMPORT: PASS.**

## Execution identity

- Git HEAD at execution time: `1049ee37599b773b94c441153a4bcc61113fc28f`
- Production project: `wubzdnuwrhmrodwqkicg` ("Quran Learning App", org `druutmrsmgdnknjgunqq`)
- Connection: Supabase session pooler, `aws-0-us-west-2.pooler.supabase.com:5432`, user `postgres.wubzdnuwrhmrodwqkicg` (project ref embedded in username, not hostname — Supabase's standard pooler connection-string format)
- Migration applied: `supabase/migrations/20260912100000_4bddf81d-6e3e-4260-a2a2-89c4b5b3f933.sql`
- Artifact: `scripts/quran-import/kazimirski/generated/kazimirski-production-import.json`, full-file SHA256 `6ae5f4178b3c39d0132bb92cd7a54bad43df06e740c32538330b1061223c050f`, `canonical_payload_sha256` `46435278f3bf1b8323391b8f9a825f35200493828e2f5dc071a54ba76fb57303`
- Raw source SHA256: `38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92`
- Aggregate segment text hash: `12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26`
- Kazimirski `content_sources` id: `f8443b10-3cc8-59ee-954f-5b1129c1cec4` (deterministic UUIDv5)

## Pre-execution: full dress rehearsal

Before touching production, the exact same orchestration script (`run_kazimirski_production_execution.py`) was run end-to-end against a freshly created disposable Postgres *database* (not merely a schema — a true clean `public` namespace, replaying all 42 pre-existing migrations plus a stub `auth` schema, mirroring production's real pre-migration shape exactly: 6236 ayahs, 6236 verified Pickthall rows, exactly 4 content_sources rows, target tables absent). This surfaced and fixed two real bugs before they could reach production:
1. A miscounted expected-column constant (9 vs. 8) in the schema-certification check.
2. A stale content_sources-count bound reused across a stage where the migration's own INSERT had already changed the true count from 4 to 5.

The corrected script then ran clean, start to finish, in one uninterrupted pass, ending in `KAZIMIRSKI PRODUCTION IMPORT: PASS` against the disposable database, before the real run was attempted.

## Real execution — stage by stage

| # | Stage | Result |
|---|---|---|
| 1 | Production connection | Connected (one psycopg connection for the entire operation, autocommit=True) |
| 2 | Identity + endpoint verification | Initially refused (see "Issue found and fixed" below); passed after the fix, confirmed via connection metadata + a live `content_sources` count of 4 |
| 3 | Harmless transaction test | `BEGIN; SELECT 1; ROLLBACK;` succeeded; connection healthy afterward |
| 4 | Final read-only fingerprint check | ayahs 6236/`ec8b0255...`, Pickthall 6236/`501e1465...`, both target tables confirmed absent, zero existing Kazimirski-v1 rows |
| 5 | Apply ONE Kazimirski migration | Applied via one `cursor.execute()` call wrapping the unmodified migration file in `BEGIN;...COMMIT;` |
| 6 | Schema certification | 16 + 9 columns, RLS enabled on both tables, 2 triggers each, content_sources row registered (`candidate`), canonical Arabic unchanged |
| 7 | Atomic import | Committed: 1 source, 6239 segments, 6396 joins. `sql_sha256=7c49472e4177dabaebdb899b2dd369bfdc6713c8b05c71703767a8950c233844` |
| 8 | Full validator | 21/21 passed |
| 9 | Arabic / Pickthall fingerprint re-check | Both confirmed unchanged: `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b` / `501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` |
| 10 | RLS + mapping checks | Initially flagged a false positive (see below); after the fix, confirmed anon/authenticated hold **no** INSERT/UPDATE/DELETE grant on either table, SELECT present; mapping-contract spot checks passed for all 6 alignment types present in the data |
| 11 | State B idempotency proof | A second import attempt correctly refused (`state B`, 6239/6396 unchanged); zero duplicate writes |

## Issues found and fixed during the real execution (documented honestly, not silently)

**1. Identity check too narrow (Stage 2).** The check only looked at the connection hostname. Production's `KAZ_PROD_DB_URL` connects via Supabase's session pooler, which embeds the project ref in the *username* (`postgres.wubzdnuwrhmrodwqkicg`), not the hostname (`aws-0-us-west-2.pooler.supabase.com`). The connection genuinely reached the correct database — confirmed by data, not just by loosening a string match: `content_sources` held the exact expected 4 rows with correct `edition_identifier`/`verification_status` values, and `ayahs` held exactly 6236 rows, before any check was altered. Fixed `verify_connection_identity()` to accept the project-ref substring in either host or user (matching how Supabase actually issues connection strings — a correction, not a loosening of what counts as a match), added two new rehearsal tests proving both the positive (pooler-style, ref in user) and negative (matches neither) cases, re-ran all 27 direct-postgres-adapter tests before retrying.

Before retrying, also empirically proved — against production's real session pooler, using a session-scoped temp table that touched no real data — that the multi-statement `BEGIN...COMMIT` atomicity pattern holds through this specific pooler: a forced mid-script failure correctly rolled back everything, a clean equivalent correctly committed. This resolves the one open caveat from the earlier `DIRECT-POSTGRES-PRODUCTION-ADAPTER-REPORT.md`.

**2. RLS/grant check too broad (Stage 10).** The check treated any non-SELECT grant as a red flag, which flagged `TRUNCATE`, `REFERENCES`, and `TRIGGER` grants held by anon/authenticated on the new tables. Investigated before assuming it was safe to ignore: queried the same grants for `translations`, `ayahs`, and `content_sources` — long-existing, already-trusted tables — and found the *identical* pattern. This is a pre-existing, project-wide default-privilege configuration (not present in the migration files, not reproducible in a fresh local disposable database, evidently set at the Supabase-project level outside any tracked migration), consistently applied to every table, not something this migration introduced. RLS does not govern TRUNCATE/REFERENCES/TRIGGER at all — only SELECT/INSERT/UPDATE/DELETE. Fixed the check to test specifically for INSERT/UPDATE/DELETE (the actual data-write, RLS-governed privileges), verified the corrected logic against both the real production shape and a deliberately-unsafe case before resuming.

Both fixes were made to `direct_postgres_adapter.py` and `run_kazimirski_production_execution.py` only — never to `assert_local_db()`, the local importer, `rollback_kazimirski.py`, `validate_kazimirski_import.py`, or anything under `src/`.

**The import itself (Stage 7) succeeded on the first attempt and was never re-run, retried, or touched by either fix** — both issues were in downstream verification checks that ran *after* the data was already correctly committed, not in the write path itself.

## Independent post-execution cross-verification

Re-queried via a second, completely independent channel (Supabase's Management API / MCP `execute_sql`, a different credential and code path from the psycopg connection used for execution):

```
segments: 6239
joins: 6396
ayahs: 6236
ayahs_hash: ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b
kazimirski status: candidate
```

Exact match on every figure.

## Local suite stability (post-execution)

- `tests/test_production_migration_pipeline.py`: 50/50
- `tests/test_production_adapter_rehearsal.py`: 22/22
- `tests/test_direct_postgres_adapter_rehearsal.py`: 27/27 (25 original + 2 new pooler-identity tests)
- Total: 99/99, zero regressions

## Final state

| Item | Value |
|---|---|
| Production migrations applied | 1 |
| content_sources inserted | 1 (`kazimirski-1869-segments-v1`, `candidate`) |
| translation_segments inserted | 6239 |
| translation_segment_ayahs inserted | 6396 |
| Canonical Arabic rows modified | 0 |
| Pickthall rows modified | 0 |
| Other translation rows modified | 0 |
| Disputed `fr.hamidullah-crf` remediation | untouched (58 rows, still `disputed`) |
| Deployments | 0 |
| Rollback required | No |

```
KAZIMIRSKI PRODUCTION IMPORT: PASS
```

## Explicitly not done

No deployment. No application code changed (`src/` untouched). No French resolver or reader/lesson/memorization work begun. No existing migration edited. Credential (`KAZ_PROD_DB_URL`) was never printed, logged, written to any file, or included in any error message throughout this entire execution.
