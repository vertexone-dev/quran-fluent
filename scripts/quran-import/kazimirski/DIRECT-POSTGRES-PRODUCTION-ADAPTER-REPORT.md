# Kazimirski Direct-Postgres Production Adapter — Report

Status: **adapter built and fully rehearsed locally. Production execution NOT performed and NOT authorized by this gate.** This is a new, separate execution channel from the earlier, still-unresolved Supabase Management-API/MCP channel (`production_adapter.py`) — that channel remains rejected on its own terms (atomicity not empirically established) and was not touched or weakened here.

## Why this channel is different, and provably stronger, than the MCP channel

The MCP channel's blocker was that `execute_sql` forwards a query string to Supabase's *private* Management API backend, whose internal handling could only be reasoned about from public documentation, never empirically observed, without either touching production or paying for a disposable branch.

This adapter instead connects to Postgres directly over the wire protocol via `psycopg` (v3, installed locally as a dev dependency) — no private intermediary. This makes the core atomicity question **empirically testable**, and it was tested, for real, against the local rehearsal Postgres instance:

```
BEGIN;
INSERT ...; INSERT ...;
DO $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$;
INSERT ...;
COMMIT;
```
sent as a single `cursor.execute()` call on an `autocommit=True` connection: raises, and the table is left with **0 rows**, not 2. A corresponding successful script correctly commits. This is the real mechanism the adapter's own rehearsal suite exercises (tests 16-23 below), not merely a reasoned inference.

**One important finding from this same experiment, not previously known:** even with `autocommit=True` at the psycopg driver level, a failure inside an explicit `BEGIN...` block leaves the *session* in Postgres's "current transaction is aborted, commands ignored until end of transaction block" state — the connection is unusable until an explicit `conn.rollback()` clears it. This is now built into the adapter as a hard requirement, not an afterthought, and is itself covered by a rehearsal test (test 20: connection usable again immediately after the explicit rollback).

## One honest caveat for eventual production use

This was proven against a **direct, non-pooled** local Postgres connection. Supabase also offers a connection-pooler endpoint (PgBouncer, historically defaulting to transaction-mode on a separate port), which can interact differently with session-level multi-statement scripts. **Whoever eventually supplies the production `DB_URL` for real execution must supply the direct/session-mode connection endpoint, not the transaction-pooler endpoint** — this adapter has no way to detect which kind of endpoint a given URL points to, so that responsibility is explicit, external, and documented in the module's own docstring.

## Design summary — `scripts/quran-import/kazimirski/direct_postgres_adapter.py`

- Credentials: `get_db_url_from_env(env_var)` reads only from an environment variable. Never written to any file, never included in an exception message, never logged. All connection metadata surfaced anywhere (`connection_metadata()`, `verify_connection_identity()`'s return value) is limited to host/port/dbname/user — password is never touched or exposed.
- One `psycopg` connection for the entire operation, `autocommit=True` so the SQL text's own embedded `BEGIN; ... COMMIT;` (from the unmodified, reused `import_production_kazimirski.build_import_transaction_sql()`) is the *only* transaction boundary.
- The import SQL is sent via exactly one `cursor.execute()` call — never split across multiple calls.
- Any exception (SQL error, postcondition `RAISE EXCEPTION`, client/connection-level failure) is caught, `conn.rollback()` is called explicitly, and the failure is re-raised/reported — never swallowed, never retried automatically. Documented reasoning for why this is safe even if the rollback call itself fails: without a successful `COMMIT` (the literal last statement, gated behind the postcondition guards), Postgres never persists anything regardless of what the client does afterward.
- Refuses (zero writes) unless live state — gathered fresh, immediately before writing, via `production_adapter.classify_state_from_facts()` (reused, already proven equivalent to the real `classify_state()`) fed by this module's own `gather_facts_live()` — classifies as state A. Never implements the state-F recovery path; that remains the local importer's exclusive responsibility.
- `verify_connection_identity()` combines client-side DSN metadata (host substring, dbname) with a live, data-level sanity check (content_sources row-count bounds) before anything else runs — never trusts either alone.
- No CLI execution entrypoint. `run_direct_import()` takes an explicit `execute: bool` (default `False`); nothing in this gate's rehearsal ever set it `True` against anything but the local disposable schema.

## Rehearsal — `tests/test_direct_postgres_adapter_rehearsal.py`, 25/25 passed

| # | Requirement | Result |
|---|---|---|
| 1-2 | Credentials read only from an environment variable; refuses when unset | PASS |
| 3-7 | Connection identity/database checks (correct case passes; dbname mismatch, host mismatch, and data-level sanity-bound mismatch all refuse; password never exposed in metadata) | PASS |
| 8-9 | Byte-identical SQL source from `build_import_transaction_sql()` | PASS |
| 10-13 | Successful commit: 1 content_sources row, 6239 segments, 6396 joins, validator 21/21, canonical Arabic + Pickthall fingerprints unchanged | PASS |
| 14-15 | Duplicate/import-existing refusal (state B) — no duplication | PASS |
| 16-20 | Rollback after a genuine mid-import SQL error (FK violation): raises, 0/0/0 rows afterward, connection usable again after explicit rollback | PASS |
| 21-23 | Rollback after a postcondition error (join-count guard): raises, 0/0 rows afterward | PASS |
| 24-25 | No commit on client/connection-level exception (deliberately closed connection): raises, zero rows written | PASS |

## Full existing suite re-run (no regressions)

- `tests/test_production_migration_pipeline.py`: 50/50 passed
- `tests/test_production_adapter_rehearsal.py` (MCP-channel adapter, prior gate): 22/22 passed
- `tests/test_direct_postgres_adapter_rehearsal.py` (this gate): 25/25 passed
- Total: 97/97, zero regressions from adding this new module

Shared local dev DB confirmed restored before and after: exactly 5 `content_sources` rows, 0 Kazimirski-v1 rows, 0 leftover test schemas.

## Confirmed unchanged this gate

- `src/`: no changes (`git status --short -- src/` empty)
- `supabase/migrations/`: only the one previously-promoted file present, no existing migration edited
- `kaz_prod_lib.py`'s `assert_local_db()`: byte-identical to every prior quote
- `import_production_kazimirski.py`, `rollback_kazimirski.py`, `validate_kazimirski_import.py`: read-only (imported for reuse), MD5-confirmed, never edited

## Verdict

```
DIRECT-POSTGRES ADAPTER: BUILT AND LOCALLY PROVEN

ATOMICITY (direct Postgres connection, non-pooled): EMPIRICALLY PROVEN
SEMANTIC EQUIVALENCE WITH REVIEWED IMPORTER: PROVEN (byte-identical SQL)
FORCED-FAILURE ROLLBACK: PROVEN (SQL error, postcondition error, client exception)
DUPLICATE-IMPORT REFUSAL: PROVEN
CREDENTIAL HANDLING: env-var only, never logged/written -- verified by test

OPEN CAVEAT: production execution requires the direct/session-mode Postgres
endpoint, not a transaction-mode connection pooler -- unverified against a
real Supabase-hosted database (only local Postgres was available to test
against this gate).

PRODUCTION EXECUTION: NOT PERFORMED. NOT AUTHORIZED BY THIS GATE.
```

## Side effects

- Production DB writes: 0
- Production migrations applied: 0
- Deployments: 0
- Production connections made: 0 (this entire gate ran against the local disposable schema only)
- Files created: `direct_postgres_adapter.py`, `tests/test_direct_postgres_adapter_rehearsal.py`, this report
- New dev dependency: `psycopg[binary]` (installed via `pip3 install --user`, same precedent as `pytest` earlier in this engagement)
- `src/`, existing migrations, `assert_local_db()`, importer, rollback, validator: unchanged
- Shared local dev DB: restored to exactly its pre-gate state
