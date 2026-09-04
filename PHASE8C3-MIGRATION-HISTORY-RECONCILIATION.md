# PHASE 8C.3 — Migration-History Reconciliation & Permanent Governance Enforcement

**Type:** Preparation only. No production data was modified. No production migration
history was modified. No migration was applied or reapplied anywhere. No
`supabase db push` or `supabase migration repair` was run against production. No
application deployment. No PR was merged.

**Date:** 2026-09-04
**Branch:** `feature/phase8c3-governance-enforcement` (based on `origin/main` @ `c729b0b37d34599bd4f4d51cd3cecba922ac144c`)
**Production project:** Supabase project id as recorded in the committed `supabase/config.toml` (no credentials or connection strings reproduced here)

---

## 1. Phase 8C.2 production result (recap)

Phase 8C.2 applied cleanly. Before/after governance state (all figures confirmed
read-only against production during Phase 8C.2 and re-confirmed read-only during
this phase):

| Field | Before | After |
|---|---|---|
| `kazimirski-1869` (legacy) `verification_status` | `candidate` | **`deprecated`** |
| `kazimirski-1869` notes | 379 chars, no marker | 904 chars: original 379 preserved verbatim + one `\n\n[Phase 8C: ` successor note |
| `kazimirski-1869-segments-v1` (active) | `candidate`, notes md5 `95cefa38c9a1eeb3e46439aca7143804` | unchanged |
| `uthmani` (canonical Arabic) | `candidate` | unchanged, still `candidate` |
| `content_sources` row count | 5 | 5 (no row created/deleted) |
| Legacy row's references (5 FKs) | 0/0/0/0/0 | 0/0/0/0/0 |
| Structural counts (114 surahs / 6236 ayahs / 6236 Pickthall / 6239 Kazimirski segments / 6396 joins / 58 lessons) | unchanged | unchanged |
| Strict validator (`REQUIRE_KAZIMIRSKI_SOURCE=true npm run validate:quran-content`) | 27/27 | 27/27 |

Exactly 1 row changed, exactly 2 columns (`verification_status`, `notes`). Rollback
was not needed and was not executed.

## 2. The migration-history version mismatch

Phase 8C.2's migration
(`supabase/migrations/20260913100000_7872f932-bfd3-42d6-b36c-36e4b8587c81.sql`) was
applied to production via the Supabase MCP connector's `apply_migration` tool. That
connector auto-assigns the migration-history version from the current timestamp at
apply time rather than reusing the applied file's own filename-derived version.

Confirmed read-only, this phase, against production's `list_migrations`:

- **Recorded exactly once:** version `20260904220940`, name
  `phase8c2_deprecate_legacy_kazimirski_20260913100000_7872f932`.
- **`20260913100000` is not recorded** anywhere in production's migration history.
- **Every other repository migration matches production history 1:1** — diffed all
  44 repo migration filenames (before adding this phase's placeholder) against the
  43 previously-recorded versions: the only repo file with no matching history
  entry was `20260913100000`; the only history entry with no matching repo file
  was the orphan `20260904220940`. No other mismatch of any kind.
- **The Phase 8C.2 database state remains correct** — re-verified read-only this
  phase (content_sources rows, statuses, notes, reference counts, structural
  counts) with no drift from §1's "After" column.
- **No other migration is pending** — same diff confirms nothing else is
  unrecorded.

This is a pure bookkeeping mismatch. The actual database content is exactly as
intended; only the tracking table's identity for this one migration diverges from
the repository's filename for it.

## 3. Options evaluated

| # | Option | Fresh replay | Existing production | Future `migration list`/`db push` | Ordering hazard | Remote/local-only entries after | Rollback/recovery | Auditability |
|---|---|---|---|---|---|---|---|---|
| 1 | `supabase migration repair` (mark `20260913100000` applied, mark `20260904220940` reverted) against production | n/a (production-only action) | **Forbidden by this phase's authorization** — modifies production migration history directly | Would be fully pristine (1:1) | none | none, if executed | Repair itself has no data rollback (it never touches data); the *action* would need separate authorization to undo | Clean, but requires a production write not authorized here |
| 2 | **Repository-side placeholder migration at version `20260904220940` (chosen)** | Placeholder no-ops wherever it sorts; the real migration keeps its own position after its dependency | Placeholder version already recorded → skipped; real migration (`20260913100000`) not yet recorded → runs, hits its own no-op branch, records itself | Both resolve cleanly to "already applied" | **None** — placeholder is a true no-op regardless of when it runs | Placeholder gives the orphan a local match; `20260913100000` becomes locally-and-remotely consistent after any future push | One-line file removal reverts the repo side; database untouched either way | A code comment explains the whole story at the placeholder's exact location |
| 3 | Do nothing; let `20260913100000` rerun and self-record on a future `db push` | Same as Option 2 for the real file (unaffected either way) | Safe — proven (see §5) — but the orphan `20260904220940` stays flagged as remote-only indefinitely | `20260913100000` self-heals; `20260904220940` keeps showing as a warning forever unless repaired | none | orphan remains remote-only forever without further action | No repo change to revert | Silent — a future operator sees an unexplained warning with no pointer to why |
| 4 | Rename `20260913100000_….sql` → `20260904220940_….sql` | **Unsafe** — reproduced and confirmed (see §5, Test 3): running the real migration's logic before `20260912100000` (which creates its required successor row) makes its own precondition 2 fail, aborting the entire fresh migration replay | Would make `db push` treat it as already applied and never run it — silently leaving `20260913100000`'s effect entirely dependent on the earlier out-of-band `apply_migration` call, with no self-healing path at all if that had somehow been wrong | Looks clean but is a false clean — the file's content no longer matches what actually ran under that version anywhere | **Yes — rejected specifically for this reason** | n/a — rejected | Reverting the rename is easy, but the danger is what happens *before* anyone notices | Actively misleading: file content and its filename-implied history diverge |
| 5 | Leave the mismatch documented but unreconciled (no repo change at all) | unaffected | Safe, same self-healing as Option 3 | Same permanent warning as Option 3 | none | orphan remains remote-only forever | none needed | This document *is* the documentation |

**Selected: Option 2.** It is the only option that (a) requires no production
write now, (b) is provably safe on both fresh replay and existing production
(§5), (c) leaves no permanent unexplained warning in `migration list`, and (d) is
fully and trivially reversible (delete one file). Option 1 is the more
"official" mechanism per Supabase's own documentation but is out of scope for
this phase's authorization. Option 4 is rejected outright — confirmed unsafe.
Options 3 and 5 are strictly dominated by Option 2 (same safety, worse
ergonomics).

## 4. Selected mechanism

**File added:** `supabase/migrations/20260904220940_phase8c3_migration_history_placeholder.sql`

- Version `20260904220940` — exactly matches the orphan entry already recorded in
  production's migration history.
- Content: **zero SQL statements** — every line is a comment. Confirmed (see §5)
  to execute successfully (exit 0, no effect) against a real PostgreSQL server.
- `supabase db push` compares **versions only**, never file content (per
  [Supabase's own `db push` documentation](https://supabase.com/docs/reference/cli/supabase-db-push)):
  "if a local migration's timestamp already exists in the remote tracking table,
  it won't be re-executed." Content is therefore irrelevant to the reconciliation
  itself, and was kept as `true zero statements` specifically so the file cannot
  possibly do anything even if that assumption were ever wrong.

## 5. Disposable-environment proof

`scripts/db-migration-tests/phase8c3-history-reconciliation.test.sh` — a
disposable, `--rm` Docker PostgreSQL container, destroyed on exit, never
touching production, CI, or any local shared database. It reproduces the
documented `db push` algorithm (apply, in ascending version order, any local
version not yet recorded; record it on success) against a minimal faithful
fixture of `content_sources` + its FK-bearing child tables (the same fixture
shape already proven correct in Phase 8C.2's own migration test).

**Result: 3/3 passed.**

| Test | What it proves | Result |
|---|---|---|
| 1. Fresh-database replay | Empty history; all four steps (legacy-insert, placeholder, successor-insert, real migration) run in version order; placeholder no-ops; real migration correctly finds its successor (created by the earlier-sorting `20260912100000` step) and deprecates the legacy row; all 4 versions end up recorded | PASS |
| 2. Existing-production-like replay | History pre-seeded with the legacy/successor/orphan-placeholder entries (matching real production); content pre-seeded already-`deprecated` (matching real production); only `20260913100000` unrecorded → runs → hits its own no-op branch → **content is byte-identical before and after**, marker count stays 1, history becomes fully consistent (4/4 recorded) | PASS |
| 3. Option 4 danger, reproduced | Running the real migration's logic *at* the earlier `20260904220940` slot (simulating a rename) — before any successor row exists — fails closed with `precondition 2 failed`, exactly as designed, rather than doing anything silently wrong | PASS |

## 6. Fresh-install replay behavior

A brand-new environment that replays every file in `supabase/migrations/` in
filename order will, after this PR: run `20260904220940` (no-op) between the
existing `20260904100000` and `20260905100000` steps — doing nothing — and later
run `20260913100000` after `20260912100000` (its successor dependency), which
will find the legacy row `candidate` (freshly inserted by `20260820100000`) and
the successor `candidate` (freshly inserted by `20260912100000`), and correctly
deprecate the legacy row. **End state is identical to production's current
state.** Proven in §5 Test 1.

## 7. Existing-production behavior

Production already has the correct **data** state (Phase 8C.2 applied). A future,
separately-authorized `supabase db push --linked` (or equivalent) against
production will, after this PR merges: skip `20260904220940` (already recorded
under that version), skip every other pre-existing migration (already recorded),
and run only `20260913100000` for the first time — which will find the legacy row
already `deprecated` with the successor marker already present, take its
documented no-op branch, change nothing, and record itself as applied. **No
production data changes as a result.** Proven in §5 Test 2. This makes that
future push a fully ordinary, low-risk migration deployment — it needs no special
handling beyond the project's normal migration-deployment procedure, specifically
because it is designed to no-op against the current state.

## 8. Future operator procedure

1. Nothing needs to happen immediately. Production is already correct.
2. Whenever the next *unrelated* migration is deployed to production through the
   normal process, this reconciliation completes itself as a side effect (per §7)
   — no dedicated "reconciliation deployment" is required.
3. If a fully pristine 1:1 history (no orphan row at all, not even a matched
   placeholder) is ever wanted, run the **NOT EXECUTED** commands in §10, under
   separate explicit authorization. This is optional cleanup, not a
   correctness requirement — §5/§7 already prove correctness without it.
4. Do **not** rename `20260913100000_….sql`. Do **not** hand-edit production's
   `supabase_migrations.schema_migrations` table outside `migration repair`.

## 9. Rollback / recovery

- **Repository side:** delete
  `supabase/migrations/20260904220940_phase8c3_migration_history_placeholder.sql`.
  No other file references it. Reverts this phase's repo-side change completely;
  the orphan history entry returns to being unmatched (back to Option 5's state),
  which remains safe, just less tidy.
- **Database side:** nothing to roll back — this phase made no database change,
  anywhere.
- **If a future `db push` is ever run against production and something
  unexpected happens:** the real migration's own one-statement rollback (documented
  in its own file header and in `PHASE8C-CONTENT-SOURCE-GOVERNANCE.md` §14.4)
  remains valid and untouched by anything in this phase.

## 10. NOT EXECUTED — REQUIRES SEPARATE AUTHORIZATION

The following would give production's migration history a fully pristine 1:1
match with the repository (removing the orphan entry entirely, rather than
matching it with a placeholder). **This is optional cleanup — §5/§7 already prove
the current, unreconciled-in-this-way state is safe.** Nothing below has been run.
Running it requires the Supabase CLI linked to production and its own separate
explicit authorization, per this phase's boundaries ("Do not run `supabase
migration repair` against production").

```bash
# NOT EXECUTED. Requires separate explicit authorization.
# Reconciles production's migration-history table to exactly match the
# repository (removes the orphan entry; records the real migration under its
# own filename version). Modifies ONLY supabase_migrations.schema_migrations —
# never runs migration SQL, never touches application data (per Supabase's own
# `migration repair` documentation).

supabase link --project-ref <production-project-ref>

# Record 20260913100000 as applied (it already is, in substance — this only
# updates the tracking table, it does not re-run any SQL):
supabase migration repair --status applied 20260913100000

# Remove the orphan entry that has no corresponding repository file:
supabase migration repair --status reverted 20260904220940

# Verify:
supabase migration list --linked
```

If this cleanup is ever performed, the placeholder file added by this PR
(`supabase/migrations/20260904220940_phase8c3_migration_history_placeholder.sql`)
should be deleted in the same change — with it gone, `20260904220940` would have
no matching local file, which is fine once the corresponding remote row is also
gone.

## 11. Arabic aggregate-hash — algorithm, purpose, and limits

Added to `scripts/validate-quran-content.mjs` via
`scripts/lib/content-source-governance.mjs` (`computeArabicAggregateSha256`).

**Algorithm (exact):**
1. Select `public.ayahs.arabic_text` for all rows.
2. Order by `(surah_number ASC, ayah_number ASC)`.
3. Join the raw, exactly-as-stored UTF-8 strings with **U+001E (RECORD
   SEPARATOR)** between them — the same separator convention already used by the
   Kazimirski aggregate hash recorded in `kazimirski-1869-segments-v1`'s own
   `content_sources.notes`.
4. **No Unicode normalization is applied.** Deliberate: nothing in this
   application ever legitimately writes `ayahs.arabic_text`, so this hash exists
   to catch **any** byte-level drift — including an incidental re-normalization
   that a "meaning-preserving" NFC hash would silently absorb.
5. SHA-256 the UTF-8 bytes of the joined string; lowercase hex digest.
6. Must cover all 6236 rows (enforced separately by the pre-existing "ayah count
   = 6236" check, which runs first).

**Pinned value:**
`ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b`

**Cross-checked by two independent implementations, computed read-only against
production, 2026-09-04 — both agreed bit-for-bit:**
- **Node:** fetch all 6236 rows via the publishable/anon key (paginated), sort
  client-side, `Array.prototype.join("")`, `crypto.createHash("sha256")`.
- **PostgreSQL (server-side, independent code path):**
  `encode(digest(string_agg(arabic_text, chr(30) ORDER BY surah_number,
  ayah_number), 'sha256'), 'hex')` (via the pre-installed `pgcrypto` extension).

Both returned `ec8b0255f03993c90c364e317e7b959110f40d8dc80ba9a705632368d693891b`.

An NFC-normalized variant was also computed both ways during authoring, as a
sanity check that Postgres's and Node's Unicode normalization implementations
agree (they do — Postgres 17's `normalize(text, NFC)` and Node's
`String.prototype.normalize("NFC")` produced the same value,
`947e6e20eaaaaf936bca0c881336e29400a360bee86e541e6d986a232ff71514`, for the NFC
variant, 5748 of 6236 rows changed under normalization). **This confirms the
algorithm choice was a deliberate decision, not an implementation gap** — the raw
(non-normalized) hash is the one pinned in the validator, for the reason in step 4
above.

**What a hash match proves:** `ayahs.arabic_text` is byte-identical, in this exact
order, to the state it was pinned in.

**What a hash match does NOT prove:** that the pinned text is itself
*authentically correct* against the Quran's canonical Uthmani text. This is a
drift tripwire, not a certification. **Independent textual cross-verification of
the Arabic corpus against an authoritative external reference remains Phase 8D's
responsibility, still open** — see `PHASE8C-CONTENT-SOURCE-GOVERNANCE.md` §6 for
the full methodology already specified for that phase (KFGQPC-primary,
QUL-corroborating, NFC-normalized character-level diff, category (a)/(b)
classification). This validator addition does not shorten or substitute for
that work in any way; if the certified Arabic corpus is ever legitimately
re-imported or corrected (by that later, separately authorized phase), this
constant must be updated alongside it, exactly like `EXPECTED_KAZIMIRSKI_SEGMENTS`
/ `EXPECTED_KAZIMIRSKI_JOINS` already are.

`uthmani` remains `verification_status = 'candidate'` — unchanged, and this phase
adds a permanent check asserting exactly that (§12), so any future accidental
promotion is caught immediately, in every environment.

## 12. Validator assertions added (`scripts/validate-quran-content.mjs` via `scripts/lib/content-source-governance.mjs`)

Run **unconditionally** (every environment — confirmed local dev's Arabic corpus
is byte-identical to production's, so no CI risk):

1. Arabic aggregate hash matches the pinned baseline (§11).
2. `uthmani` remains `verification_status = candidate`.

Run **whenever the certified Kazimirski corpus is present** (same gate as the
pre-existing segment/join checks — i.e. production today; absent, and therefore
skipped with the pre-existing INFO note, on local dev/CI, which never receives
this corpus via `supabase/migrations/`):

3. Exactly one legacy `kazimirski-1869` `content_sources` row exists.
4. That row is `verification_status = deprecated`.
5. Its Phase 8C successor marker (`\n\n[Phase 8C: `) appears exactly once.
6. Its notes name the active successor (`kazimirski-1869-segments-v1`).
7. Every `legacy_interim = true` source is `deprecated` or `disputed`.
8. The active Kazimirski source resolves uniquely under the **application's own
   exact identity predicate** (`content_type=translation`, `language=fr`,
   `translator='Albin de Kazimirski Biberstein'`,
   `edition_identifier='kazimirski-1869-segments-v1'`,
   `verification_status != disputed'` — mirrors `src/lib/kazimirski.ts`
   `resolveApprovedFrenchSource()` exactly).
9. No `disputed` or `legacy_interim = true` source can structurally satisfy that
   same predicate (proven, not merely observed on today's data — see
   `scripts/lib/content-source-governance.test.ts`).

Confirmed against production (strict): **36/36 checks passed** (27 pre-existing +
9 new). Confirmed against local dev (non-strict, mirrors `ci.yml`): **13/13
checks passed** (11 pre-existing + the 2 unconditional new checks; checks 3–9
correctly skip via the pre-existing "Kazimirski corpus absent" INFO branch — no
CI regression). No existing assertion was weakened, removed, or had its threshold
loosened.

## 13. Actions explicitly NOT taken

- No production migration history modified (no `migration repair`, no manual
  edit of `supabase_migrations.schema_migrations`).
- No migration applied or reapplied anywhere (production, CI, or local).
- No `supabase db push` run against production.
- No production data modified.
- No application deployment.
- No promotion of `uthmani` — still `candidate`, and now permanently asserted so.
- No modification to Quran text, Pickthall, Kazimirski segments, mappings,
  lessons, or user data.
- No secret read, exposed, rotated, or modified.
- No merge of the resulting PR.
