# Kazimirski Production Execution Channel Adaptation — Report (v2)

Status: **adapter built, fully tested locally. Remote-channel atomicity remains empirically unverified — this is the sole open item.** This report supersedes the v1 report (which stopped at "MCP cannot reach the project at all"). The MCP connector has since been re-authenticated against the correct organization (`druutmrsmgdnknjgunqq`) and can now reach `wubzdnuwrhmrodwqkicg`. Nothing in this gate applied anything to production, modified `assert_local_db()`, the local importer, the rollback tool, the validator, or anything under `src/`.

## 1. `assert_local_db()` — confirmed unchanged

`kaz_prod_lib.py:147-151`, re-read fresh from disk this gate, is byte-identical to every prior quote of it. Not imported, not called, not modified by the new adapter module.

## 2. MCP capability investigation

- `execute_sql(project_id, query)` and `apply_migration(project_id, name, query)` each take one query string per call; there is no multi-call transaction concept in the tool surface.
- Traced to the official Supabase MCP server source (`supabase-community/supabase-mcp`, `packages/mcp-server-supabase/src/tools/database-operation-tools.ts` → `platform/api-platform.ts`): `execute_sql` forwards the entire query string as one field in one `POST /v1/projects/{ref}/database/query` call to Supabase's Management API.
- PostgreSQL's own protocol docs (postgresql.org, "Multiple Statements in a Simple Query") confirm that a single request containing several semicolon-separated statements runs inside an implicit transaction block: committed together on full success, rolled back together (remaining statements never executed) on the first failure. This is genuine wire-protocol behavior.
- What remains unverifiable from public information: how Supabase's *private* Management API backend internally executes the submitted string against Postgres. No first-party Supabase documentation states this as an explicit API contract.
- **Attempted empirical verification, this gate:** re-checked whether any second, disposable Supabase project is reachable to safely force a real mid-transaction failure through `execute_sql` without touching production. `list_projects` now returns exactly one project — `wubzdnuwrhmrodwqkicg` itself (the earlier session's unrelated `ubuntu-diaspora` project is no longer visible under this connector's current authorization). Creating a new disposable project/branch requires `confirm_cost` (a billed action) that was not authorized this gate. Testing atomicity by deliberately forcing a failure directly against production is explicitly forbidden this gate ("Do not apply anything to production during this gate"). **Conclusion: real-channel atomicity is still not empirically provable within this gate's constraints.**

## 3. Adapter built — `scripts/quran-import/kazimirski/production_adapter.py`

Design: a pure SQL-text generator, containing zero network code, zero subprocess calls, zero DB driver imports — it cannot execute anything against anything, local or remote, by construction. It:
- Imports and calls, unmodified, `import_production_kazimirski.load_and_validate_artifact()` and `.build_import_transaction_sql()` — the actual reviewed SQL-generation code, not a reimplementation.
- Adds one new pure function, `classify_state_from_facts()`, a deliberate near-line-for-line port of `classify_state()`'s branching logic, adapted to operate on a pre-fetched facts dict instead of live `psql` queries.
- Deliberately does **not** implement the state-F recovery path — encountering state F is a hard refusal through this channel, full stop. Recovery, if ever needed, remains the local importer's exclusive, already-reviewed, 9-condition-gated `--recover-after-rollback` responsibility.
- Requires state A before generating any SQL; states B/C/D/E/F are all hard refusals with zero SQL produced.
- Dry-run/summary mode reports SQL SHA256, byte length, statement count, target tables, expected row counts, and a human-readable transaction-structure outline — never the full 6,239-segment payload.

## 4. Local rehearsal — `tests/test_production_adapter_rehearsal.py`, 22/22 passed

Run against a disposable, isolated Postgres schema (`kaz_adapter_rehearsal_test`) inside the same local dev cluster, migration rendered into it via the existing `render_migration_for_test_schema` helper — never touching the shared DB's Phase 3 prototype tables. Confirmed via direct query, before and after: shared local DB restored to exactly 5 `content_sources` rows, zero Kazimirski-v1 rows, zero leftover schemas.

| # | Check | Result |
|---|---|---|
| 1-2 | `classify_state_from_facts()` vs. real `classify_state()`: identical state and detail for the same DB content | PASS |
| 3 | Adapter-generated SQL byte-for-byte identical to `build_import_transaction_sql()` called directly with the same inputs | PASS (one harness bug found and fixed along the way — see below) |
| 4-6 | Adapter summary reports correct expected counts and a self-consistent SQL hash | PASS |
| 7-9 | Executing the adapter-generated SQL locally: 1 content_sources row, 6239 segments, 6396 joins | PASS |
| 10 | Standalone validator (21 checks) passes against adapter-imported data | PASS (21/21) |
| 11-12 | Canonical Arabic / Pickthall fingerprints unchanged after adapter import | PASS |
| 13-16 | Forced mid-transaction failure (one join deliberately dropped so the postcondition guard fires after all INSERTs ran): raises, and content_sources/segments/joins all = 0 afterward | PASS |
| 17-18 | Duplicate re-execution: adapter refuses to generate SQL once state is B; segment count stays exactly 6239 | PASS |
| 19 | Existing `rollback_kazimirski.py`, unmodified, works correctly against adapter-created data | PASS |
| 20-22 | Full row-level dump (all persisted columns) from the original importer's path vs. the adapter's path: byte-for-byte identical | PASS |

**Harness bug found and fixed during this gate (documented honestly, not silently):** the first run of check #3 failed. Investigation showed the migration file itself inserts the `content_sources` row as part of schema application — so by the time the SQL-generation-equivalence test ran, that row already existed, and the adapter correctly detected `content_source_pre_exists=True`. My own test comparison had hardcoded `content_source_pre_exists=False` for the "original importer" side of the comparison, which was simply wrong, not a real divergence. Fixed by deriving the flag from the real `classify_state()` call on both sides. A second, related bug (test #17 reusing a stale SQL string captured under an earlier, no-longer-current DB state) was found and fixed the same way — regenerate from current facts, never reuse a captured string across a state change.

## 5. Full existing pipeline suite re-run

`tests/test_production_migration_pipeline.py`: 50/50 passed, unchanged from before this gate — no regressions from adding the adapter module.

## 6. Read-only production facts (from the now-working MCP channel, via Part earlier this session)

Cross-checked against the adapter's expectations: production is currently in a pre-migration state (`translation_segments`/`translation_segment_ayahs` absent, no `kazimirski-1869-segments-v1` content_sources row) — the adapter's `classify_state_from_facts()` correctly treats `tables_exist=false` as the pre-migration equivalent of "zero existing rows," which is documented explicitly in the adapter's own module docstring as a deliberate adaptation for this exact shape (classify_state's real DB-shape assumption is "schema already migrated" — production isn't there yet).

## Final table

| Invariant | Original Importer | Production Adapter | PASS/FAIL |
|---|---|---|---|
| `assert_local_db()` unchanged | n/a | unchanged, verified | PASS |
| Frozen artifact/importer/validator/rollback treated as authoritative, not re-derived | n/a | confirmed (direct imports, no reimplementation) | PASS |
| Adapter built, minimal (no DB/network code) | n/a | confirmed by construction | PASS |
| MCP channel can reach production project | n/a | now yes (`get_project` succeeds) | PASS |
| classify_state equivalence | n/a | 2/2 | PASS |
| SQL-generation equivalence (byte-for-byte) | n/a | confirmed identical | PASS |
| Local execution + validator | n/a | 21/21 | PASS |
| Canonical Arabic fingerprint unchanged | `ec8b0255...` | `ec8b0255...` | PASS |
| Pickthall fingerprint unchanged | `501e1465...` | `501e1465...` | PASS |
| Forced-failure full rollback | n/a | 0/0/0 confirmed | PASS |
| Duplicate/re-execution refusal | n/a | confirmed refuses, no duplication | PASS |
| Rollback compatibility | n/a | confirmed | PASS |
| Full row-level equivalence vs. original importer | n/a | byte-identical | PASS |
| Target tables restricted to the two new tables + one content_sources row | n/a | confirmed by SQL construction | PASS |
| Unexpected mutations (ayahs/translations/other sources) | n/a | none — never referenced except read-only baseline checks | PASS |
| Full pipeline tests | 50/50 | n/a | PASS |
| Adapter tests | n/a | 22/22 | PASS |
| `src/` unchanged | n/a | unchanged | PASS |
| Existing migrations unchanged | n/a | unchanged (one new file only) | PASS |
| Production writes | 0 | 0 | PASS |
| Production migrations applied | 0 | 0 | PASS |
| Deployments | 0 | 0 | PASS |
| **Real remote-channel atomicity (single `execute_sql` call honoring an explicit BEGIN/COMMIT payload)** | n/a | **not empirically provable this gate** (no safe sandbox project available; production writes forbidden this gate) | **UNVERIFIED** |

## Verdict

Per this gate's own stated rule ("If MCP cannot guarantee atomic execution of the complete data import: FAIL"), and since "cannot guarantee" is being read strictly as "cannot be proven," not "no evidence either way":

```
KAZIMIRSKI PRODUCTION EXECUTION ADAPTER: FAIL

BLOCKER:
ATOMIC PRODUCTION IMPORT CANNOT BE EMPIRICALLY GUARANTEED THROUGH THE AVAILABLE CHANNEL.

Everything within reach of local testing is fully proven: SQL-generation
equivalence with the reviewed importer (byte-for-byte), local execution,
validator, fingerprint stability, forced-failure full rollback, duplicate-
refusal, rollback compatibility. The one remaining gap is that the actual
Supabase Management API backend's handling of a single multi-statement
execute_sql call has never been empirically observed to be atomic -- only
reasoned about from public protocol documentation and the tool's own
source, which forwards the string as one call but does not document what
happens inside Supabase's private backend.

Closing this gap requires either:
  (a) authorization to create a disposable Supabase branch (a billed
      action, needs confirm_cost) to safely force a real mid-transaction
      failure through this exact channel and observe the result, or
  (b) accepting the reasoned-but-unproven conclusion as sufficient, or
  (c) using the local importer with a real production DB password instead
      of this channel.

STOP.
```

## Side effects

- Production DB writes: 0
- Production migrations applied: 0
- Deployments: 0
- Files created: `production_adapter.py`, `tests/test_production_adapter_rehearsal.py`, this report (updated)
- `src/`: unchanged
- Existing migrations: unchanged
- `assert_local_db()` / importer / rollback / validator: unchanged
- Shared local dev DB: restored to exactly its pre-gate state (verified: 5 content_sources rows, 0 Kazimirski-v1 rows, 0 leftover schemas)
