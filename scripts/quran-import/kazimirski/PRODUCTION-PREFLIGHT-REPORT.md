# Kazimirski Production Preflight Report (MCP channel)

Status: read-only only. No production mutation performed. This supersedes nothing from the earlier PostgREST-based preflight — it independently reconfirms the same facts through a second, different channel (Supabase MCP management API instead of the JS/PostgREST client), which is a stronger result than either check alone.

## 1. MCP authorization

- `list_projects` now returns `wubzdnuwrhmrodwqkicg` ("Quran Learning App", org `druutmrsmgdnknjgunqq`, region `us-west-2`, Postgres 17.6.1.155, `ACTIVE_HEALTHY`).
- `get_project("wubzdnuwrhmrodwqkicg")` succeeds and returns the identical record.
- This exactly matches the project ref recorded in `supabase/config.toml` and resolved from `.env`'s `VITE_SUPABASE_URL` throughout every prior gate.

## 2. Schema / migration state

- `list_tables` (schema `public`) enumerates 37 tables. `translation_segments` and `translation_segment_ayahs` are **absent** from the list.
- Cross-checked directly via SQL: `SELECT to_regclass('public.translation_segments'), to_regclass('public.translation_segment_ayahs')` → both `NULL`. Independent confirmation, via a third distinct method (PostgREST `SELECT *` → `PGRST205` in the earlier preflight; MCP `list_tables` absence; MCP `execute_sql` `to_regclass` NULL).
- `list_migrations` returns 42 applied migrations, latest `20260911110000`. The promoted Kazimirski migration `20260912100000_...` is **not** in this list — confirmed still pending, not yet applied. No migration beyond `20260911100000`'s pair exists that isn't accounted for by the local `supabase/migrations/` directory.
- `content_sources` = 4 rows: `fr.hamidullah-crf` (disputed), `kazimirski-1869` (candidate — the pre-existing legacy interim source, not the new segments-based one), `pickthall-gutenberg-16955` (verified), `uthmani` (candidate). No `kazimirski-1869-segments-v1` row, no row with id `f8443b10-3cc8-59ee-954f-5b1129c1cec4`.

## 3. No partial Kazimirski import exists

- Both target tables absent entirely (not merely empty) — there is no partial or orphaned Kazimirski data of any kind in production.
- No content_sources row under either the new edition_identifier or the new deterministic id.

## 4. Baseline fingerprints (unaffected data, re-confirmed via direct SQL)

| Metric | Value |
|---|---|
| Canonical ayahs count | 6236 |
| Canonical Arabic fingerprint | `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b` |
| Pickthall count | 6236 |
| Pickthall fingerprint | `501e14655a290abcbda62096c30cccfe6dec3e400316de8b8ba414e5ca13962f` |
| Disputed `fr.hamidullah-crf` rows | 58 |

All four values are exact matches to every prior independent computation across this entire project (local dev DB, three separate disposable-DB rehearsals, and the earlier PostgREST-based production preflight).

## Conclusion

Production state is unchanged and exactly as expected: the Kazimirski migration is genuinely pending, no schema or data collision exists, and the existing disputed-French remediation and canonical/Pickthall content are intact. Nothing here changes the FINAL PREFLIGHT TABLE or verdict already recorded from the earlier gate.

## Side effects

- Production DB writes: 0
- Production migrations applied: 0
- Deployments: 0
- Files created: this report only
- `src/`, importer, rollback, validator, `assert_local_db()`: unchanged
