# Kazimirski French Translation — Production Migration & Import Design

**Status: DESIGN ONLY. No migration created or applied. No production writes. No
import executed. No resolver, Reader, Memorization, or Lessons code touched. No
deployment.** This document is the deliverable for the "Production Migration / Import
Design — Phase 1" gate, built after Phase 5's human review reached 25/25 and its
final integrity audit returned PASS.

---

## 1. Executive decision

Build the production schema as two new tables (`translation_segments`,
`translation_segment_ayahs`) that closely mirror the already-validated local
prototype, register Kazimirski as a `disputed`-sibling-but-distinct `content_sources`
row (public domain, not disputed — unlike `fr.hamidullah-crf`), and import the
6,239 segments / 6,396 joins from a single frozen, hash-verified **production import
artifact** generated deterministically from the approved Phase 4/5 manifest — never
from hand-written SQL, and never deciding a mapping at migration time. Schema and
data land in two separate, ordered migration files (Option A family, refined below),
gated by explicit precondition/postcondition guards in the same style already proven
in this codebase's `fr.hamidullah-crf` remediation migration. Recommended verdict:
**GO for implementation, once three unresolved design questions in §22 are answered
by the user** — none of them block writing the code, but one blocks safely *applying*
it to production.

---

## 2. Existing schema analysis (§A)

Read directly from the current schema (local Postgres, which mirrors production) and
from `supabase/migrations/`:

**`content_sources`** (unchanged by this design — Kazimirski fits the existing shape
with zero new columns): `id uuid PK, content_type text NOT NULL CHECK IN
('arabic_text','translation'), provider_name text NOT NULL, dataset_name text NOT
NULL, edition_identifier text, language text NOT NULL CHECK IN ('ar','en','fr'),
translator text, version text, license_name text NOT NULL, license_url text,
attribution_required boolean NOT NULL DEFAULT false, modification_restricted boolean
NOT NULL DEFAULT false, source_url text NOT NULL, retrieved_at timestamptz,
public_domain boolean NOT NULL DEFAULT false, legacy_interim boolean NOT NULL DEFAULT
false, verification_status text NOT NULL DEFAULT 'candidate' CHECK IN
('candidate','verified','disputed','deprecated'), notes text, created_at
timestamptz`. Read policy: `FOR SELECT TO anon, authenticated USING (true)`, no
client write policy.

**`translations`** (unchanged, untouched by Kazimirski — remains the simple 1:1
governed-source table Pickthall alone uses): `id, surah_number, ayah_number, text NOT
NULL CHECK (btrim<>''), source_id FK, created_at, updated_at` +
`UNIQUE(surah_number,ayah_number,source_id)` + FK to `ayahs(surah_number,ayah_number)
ON DELETE RESTRICT` + `translations_updated_at` trigger using the existing
`update_updated_at_column()` function. Read-only RLS, same shape as
`content_sources`.

**`ayahs`**: `id, surah_number, ayah_number, arabic_text NOT NULL, translation_en,
translation_fr, created_at, arabic_source_id` — never written to by this design.

**Migration file convention**: `supabase/migrations/YYYYMMDDHHMMSS_<uuid>.sql`, one
statement-group per concern, most recent files (`20260907100000` through
`20260911110000`) include explicit precondition/postcondition `DO $$ ... RAISE
EXCEPTION $$` blocks — this pattern (proven in the `fr.hamidullah-crf` remediation
migration already live in production) is what this design reuses, not a novel
invention.

**No existing production migration uses a column-level immutability trigger**
(`IS DISTINCT FROM OLD` guard). This design introduces that pattern for the first
time in this codebase — flagged explicitly as new, not "matching an existing
convention," and justified in §7 by the fact that no prior table needed a
text-can-never-silently-change guarantee this strong.

**`update_updated_at_column()`** already exists and is reused by `translations`,
`review_items`, and others — this design reuses it unchanged rather than defining a
duplicate.

**Phase 2/3 artifacts reviewed, not copied unchanged**: `PHASE2-MAPPING-ARCHITECTURE.md`
(source of the original two-table shape), `local-prototype/001_translation_segments_schema.sql`
(the actual DDL that's been running locally through all of Phase 3–5 validation — used
as the *starting point*, not the final answer; see §4 for exact deltas), the frozen
manifest, and every Phase 5 decision/evidence artifact.

**Actual enum values in current use** (queried directly, not recalled from memory):
`alignment_status`: `auto_verified, cross_verified, human_verified` (in current data
— `unresolved` and `rejected` are valid domain values from the design but have zero
rows right now, since Phase 4/5 resolved everything). `mapping_confidence`: `auto,
cross_verified, human_verified` (in current data — `needs_review` is a valid,
necessary *transient* domain value used during Tier 2 review before sign-off, now
zero rows since all 8 compound cases were approved). `alignment_type`: `compound,
direct, many_to_one, offset, one_to_many, source_anomaly` (six of the seven domain
values present; `unresolved` has zero rows, correctly, since Phase 4 closed both
cases). `segment_type`: `numbered, unnumbered_preamble`.

---

## 3. Final proposed production schema (§B)

Same two-table conceptual shape as the prototype — no safer equivalent found in
existing conventions that would better serve this data's actual structure (a
segment/join split is exactly what one_to_many and many_to_one require, and nothing
in `content_sources`/`translations` accommodates that). One material change from the
prototype:

> **`translation_segment_ayahs` gains `reviewer_notes`, `reviewed_by`, `reviewed_at`.**
> Phase 5 proved join-level review provenance is a real, load-bearing need — every
> Tier 2 compound-case decision recorded its evidence in the external
> `PHASE5-REVIEW-DECISIONS.json` ledger precisely *because* the prototype's join table
> had nowhere to put it (documented as a known gap during Phase 5, decision
> `phase5-003`). Production must not repeat that gap: a future reviewer or auditor
> should be able to answer "who approved this specific mapping and why" from the
> database alone, not from an external JSON file that could go missing, drift, or
> never make it into git.

### `translation_segments`

```sql
CREATE TABLE public.translation_segments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                uuid NOT NULL REFERENCES public.content_sources(id),
  surah_number             integer NOT NULL REFERENCES public.surahs(number),

  segment_type             text NOT NULL DEFAULT 'numbered'
                              CHECK (segment_type IN ('numbered', 'unnumbered_preamble')),

  source_ordinal           integer NOT NULL CHECK (source_ordinal >= 0),
  source_declared_number   integer CHECK (source_declared_number IS NULL OR source_declared_number > 0),

  text                     text NOT NULL CHECK (btrim(text) <> ''),
  text_sha256              text NOT NULL CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  extraction_source_ref    text NOT NULL,

  alignment_type           text NOT NULL DEFAULT 'unresolved'
                              CHECK (alignment_type IN (
                                'direct', 'offset', 'one_to_many', 'many_to_one',
                                'compound', 'unresolved', 'source_anomaly'
                              )),
  alignment_status         text NOT NULL DEFAULT 'auto_verified'
                              CHECK (alignment_status IN (
                                'auto_verified', 'cross_verified', 'human_verified',
                                'unresolved', 'rejected'
                              )),

  reviewer_notes           text,
  reviewed_by              text,
  reviewed_at              timestamptz,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  UNIQUE (source_id, surah_number, source_ordinal)
);
```

### `translation_segment_ayahs`

```sql
CREATE TABLE public.translation_segment_ayahs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id         uuid NOT NULL REFERENCES public.translation_segments(id) ON DELETE RESTRICT,
  surah_number       integer NOT NULL,
  ayah_number        integer NOT NULL,

  mapping_confidence text NOT NULL DEFAULT 'auto'
                        CHECK (mapping_confidence IN ('auto', 'cross_verified', 'human_verified', 'needs_review')),

  reviewer_notes     text,
  reviewed_by        text,
  reviewed_at        timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),

  FOREIGN KEY (surah_number, ayah_number)
    REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT,
  UNIQUE (segment_id, surah_number, ayah_number)
);
```

No `updated_at` on the join table — join rows are created once at import time and
only ever gain review metadata (via UPDATE of the three review columns), which is
adequately timestamped by `reviewed_at` itself; a generic `updated_at` would be
redundant.

---

## 4. Constraints and indexes (§C)

| Constraint | Table | Enforcement | Rationale |
|---|---|---|---|
| `UNIQUE(source_id, surah_number, source_ordinal)` | segments | DB | no duplicate physical position within one source |
| `text NOT NULL`, non-empty | segments | DB | never store a blank segment |
| `text_sha256` format (`^[0-9a-f]{64}$`) | segments | DB | catches a malformed hash at write time, cheap |
| `source_ordinal >= 0` | segments | DB | 0 is reserved for the Fatiha preamble; negative is never valid |
| `source_declared_number > 0` when present | segments | DB | Kazimirski's own printed numbers are always positive; `NULL` stays `NULL` (see §K) |
| `alignment_type` domain | segments | DB CHECK | closed enum, matches §E |
| `alignment_status` domain | segments | DB CHECK | closed enum, matches §E |
| `UNIQUE(segment_id, surah_number, ayah_number)` | joins | DB | no duplicate join row for the same segment→ayah pair |
| FK `(surah_number, ayah_number)` → `ayahs` | joins | DB | every join must reference a real canonical āyah |
| `mapping_confidence` domain | joins | DB CHECK | closed enum, includes the transient `needs_review` value |

**Indexes**: `translation_segments (surah_number, source_ordinal)` (primary render
path — resolver reads a whole surah's segments in order), a partial index on
`alignment_status WHERE alignment_status IN ('unresolved','human_verified')` (review
queue queries), `translation_segment_ayahs (surah_number, ayah_number)` (the
resolver's actual lookup key — given `(surah, ayah)`, find every contributing
segment), `translation_segment_ayahs (segment_id)` (reverse lookup, e.g. "does this
segment map elsewhere too").

**Database-enforceable vs import-time invariants — explicit split, per the gate's
own instruction not to invent fragile triggers:**

| Invariant | Enforcement |
|---|---|
| A segment cannot join an āyah from a different surah | **Import-time.** A CHECK comparing `translation_segment_ayahs.surah_number` to the parent `translation_segments.surah_number` requires a trigger or a generated column referencing another table — Postgres CHECK constraints cannot reference a different table. A `BEFORE INSERT` trigger *could* do this, but every one of the 6,396 joins is already produced by a generator that owns this invariant (§8, gate 15); a DB trigger here would duplicate logic the import pipeline already guarantees, for a case that structurally cannot occur once the generator is correct. **Not implemented as a DB trigger** — validated by the import generator and re-verified as a production postcondition (§20) instead. |
| `direct`/`offset` segments have exactly one join | **Import-time**, same reasoning — cardinality-vs-type consistency is exactly what Phase 5's own audit (§J of the final gate) checked by direct query, not by a DB constraint, and that pattern is reused here. |
| `one_to_many` has >1 join | **Import-time**, same reasoning. |
| `many_to_one` cardinality (2+ *segments* sharing one target) | **Cannot be a simple CHECK at all** — it's a property of a *set* of segments, not a single row. Import-time only. |
| No orphaned join (segment_id resolves) | **DB**, via the FK itself. |
| No invalid canonical target | **DB**, via the FK to `ayahs`. |

This mirrors exactly how Phase 5's final audit worked in practice: the database
enforces what a single-row CHECK or FK genuinely can, and everything that requires
comparing across rows or tables is a **generator-time refusal** (§8) plus a
**postcondition re-verification** (§20) — never a trigger invented under time
pressure to catch something better caught earlier in the pipeline.

---

## 5. Immutability strategy (§D)

**Immutable after insertion** (identity/provenance — the "what Kazimirski actually
wrote" facts): `source_id, surah_number, segment_type, source_ordinal,
source_declared_number, text, text_sha256, extraction_source_ref, alignment_type`,
and — on the join table — `segment_id, surah_number, ayah_number` (the mapping
identity itself; a `rejected` mapping gets a *new* corrected row, per Phase 2's own
design, never a rewritten one).

**Mutable** (review state, which is expected to evolve as review happens):
`alignment_status, reviewer_notes, reviewed_by, reviewed_at` on segments;
`mapping_confidence, reviewer_notes, reviewed_by, reviewed_at` on joins.
`updated_at` on segments moves whenever any mutable field changes (existing trigger
convention).

**Enforcement**: a single `BEFORE UPDATE` trigger per table, first production use of
this pattern in this codebase (noted as new in §2, not borrowed):

```sql
CREATE FUNCTION public.translation_segments_immutable_fields() RETURNS trigger AS $$
BEGIN
  IF NEW.source_id IS DISTINCT FROM OLD.source_id
     OR NEW.surah_number IS DISTINCT FROM OLD.surah_number
     OR NEW.segment_type IS DISTINCT FROM OLD.segment_type
     OR NEW.source_ordinal IS DISTINCT FROM OLD.source_ordinal
     OR NEW.source_declared_number IS DISTINCT FROM OLD.source_declared_number
     OR NEW.text IS DISTINCT FROM OLD.text
     OR NEW.text_sha256 IS DISTINCT FROM OLD.text_sha256
     OR NEW.extraction_source_ref IS DISTINCT FROM OLD.extraction_source_ref
     OR NEW.alignment_type IS DISTINCT FROM OLD.alignment_type
  THEN
    RAISE EXCEPTION 'translation_segments identity fields are immutable (segment %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

...and the mirror for `translation_segment_ayahs` protecting `segment_id,
surah_number, ayah_number`. Review-metadata columns are updated through a normal
`UPDATE ... SET alignment_status = ..., reviewed_by = ..., reviewed_at = now()`,
never requiring the text to be rewritten alongside it — exactly the gate's
requirement.

---

## 6. RLS design (§M)

Identical shape to `content_sources`/`translations` — this is curriculum reference
content, not user data:

```sql
ALTER TABLE public.translation_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segments_read_all ON public.translation_segments
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.translation_segment_ayahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segment_ayahs_read_all ON public.translation_segment_ayahs
  FOR SELECT TO anon, authenticated USING (true);
```

No `INSERT`/`UPDATE`/`DELETE` policy for `anon` or `authenticated` — matching
`translations` exactly. All writes (import, and any future review-status update) go
through the migration/service-role path, never the client. This doesn't weaken
anything: it's the same boundary already trusted for Pickthall.

---

## 7. Content source design (§F)

```sql
INSERT INTO public.content_sources (
  content_type, provider_name, dataset_name, edition_identifier, language,
  translator, version, license_name, license_url, attribution_required,
  modification_restricted, source_url, retrieved_at, public_domain,
  legacy_interim, verification_status, notes
) VALUES (
  'translation',
  'Wikisource (fr.wikisource.org)',
  'Le Koran (traduction de Kazimirski)',
  'kazimirski-1869-segments-v1',
  'fr',
  'Albin de Kazimirski Biberstein',
  'Charpentier, Paris, 1869 printing (translation first published 1840)',
  'Public domain',
  NULL,
  true,
  false,
  'https://fr.wikisource.org/wiki/Le_Koran_(Traduction_de_Kazimirski)/Texte_entier',
  '<retrieval timestamp from Phase 1>',
  true,
  false,
  'candidate',
  '<full provenance note: translator death 1887, edition history, digitization
    chain (Google Books ID 3XSe413MJyQC, Harvard Library copy), raw source SHA256
    38f94de9..., aggregate segment hash 12015b8f..., Phase 1-5 audit trail
    reference, distinguishing this governed record from the pre-existing unrelated
    empty kazimirski-1869 content_sources row from an earlier Phase-2A design
    (left untouched)>'
);
```

`verification_status = 'candidate'`, not `'verified'` — Phase 5 completed *human
review of the alignment/mapping*, which is a different claim from *this translation
is production-verified as accurate French*. Recommend `'candidate'` until a
qualified French-Quranic-literate reviewer (distinct from the alignment-mechanics
review Phase 5 performed) signs off on translation quality — this is flagged as an
open question in §22, not decided unilaterally here. **No Hamidullah, no other
disputed source, is referenced anywhere in this design.**

---

## 8. Import artifact contract (§G)

One file, `kazimirski-production-import.json`, generated deterministically and never
hand-edited:

```jsonc
{
  "schema_version": "1.0.0",
  "generator_version": "kazimirski-import-gen-v1",
  "generated_at": "<ISO 8601 timestamp>",

  "raw_source_sha256": "38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92",
  "aggregate_segment_text_hash": "12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26",
  "manifest_hash": "<sha256 of kazimirski_alignment_manifest.json itself, pinning which manifest version this artifact was generated from>",

  "source_segment_count": 6239,
  "join_count": 6396,
  "canonical_coverage": "6236/6236",

  "provenance_reference": "scripts/quran-import/kazimirski/ (Phase 1-5), PHASE5-REVIEW-DECISIONS.json (25 decisions)",

  "content_source": { /* the exact INSERT fields from §7 */ },

  "segments": [
    {
      "source_id_placeholder": "kazimirski-1869-segments-v1",
      "surah_number": 101, "segment_type": "numbered", "source_ordinal": 1,
      "source_declared_number": 1, "text": "...", "text_sha256": "...",
      "extraction_source_ref": "texte_entier_raw.html#surah-101-li-1",
      "alignment_type": "one_to_many", "alignment_status": "auto_verified",
      "reviewer_notes": null, "reviewed_by": null, "reviewed_at": null
    }
    /* ... all 6,239, human_verified rows carry real reviewer_notes/reviewed_by/reviewed_at */
  ],

  "joins": [
    { "segment_key": "101:1", "surah_number": 101, "ayah_number": 1,
      "mapping_confidence": "auto", "reviewer_notes": null, "reviewed_by": null, "reviewed_at": null }
    /* ... all 6,396 */
  ]
}
```

`segment_key` (`"<surah>:<source_ordinal>"`) is how joins reference their segment —
the artifact predates real UUIDs (§J), so it can't reference a segment by a
not-yet-created database `id`.

**Required per-segment fields**: exactly the 9 non-generated columns of
`translation_segments` (`surah_number, segment_type, source_ordinal,
source_declared_number, text, text_sha256, extraction_source_ref, alignment_type,
alignment_status`) plus the 3 review columns.
**Required per-join fields**: `segment_key, surah_number, ayah_number,
mapping_confidence` plus the 3 review columns.

---

## 9. Import generator contract (§H)

Reads: the frozen `texte_entier_raw.html`, `kazimirski_alignment_manifest.json`
(v2, post-Phase-4), and `PHASE5-REVIEW-DECISIONS.json` (25 decisions). Writes: the
artifact in §8. Runs entirely locally, produces a file — never touches any database.

**Hard gates, each an unconditional refusal, no partial output on failure:**

1. Deterministic — same three inputs always produce byte-identical output.
2. Refuses if any manifest segment has `alignment_type='unresolved'` with a filled
   `canonical_targets` (would mean a guess slipped through) — and, conversely,
   refuses if it finds a *resolved* segment still lacking a `human_verified` decision
   trail where Phase 5's own ledger says it should have one.
3. Recomputes `raw_source_sha256` from the frozen HTML file itself — refuses on
   mismatch.
4. Recomputes `aggregate_segment_text_hash` from the manifest's own segments in
   `(surah_number, source_ordinal)` order — refuses on mismatch.
5. Refuses unless segment count = 6,239 exactly.
6. Refuses unless join count = 6,396 exactly.
7. Refuses unless canonical coverage = 6,236/6,236 (every canonical āyah reachable
   through at least one join).
8. Refuses unless all 25 decisions in `PHASE5-REVIEW-DECISIONS.json` have
   `decision: "APPROVE"` (a single `REJECT`/`NEEDS_MORE_REVIEW` anywhere halts
   generation entirely — Phase 5 was "all or nothing" by design, no partial-approval
   import path exists).
9. Refuses unless exactly 57 segments and 80 joins are attributable to those 25
   decisions (reusing the exact reconciliation logic from the Phase 5 final audit,
   §F there) — a drift here means the ledger and the DB disagree, generation stops.
10. Refuses unless it reconciles to exactly 57 human-verified segments in the source
    DB.
11. Refuses unless it reconciles to exactly 80 human-verified joins in the source DB.
12. Preserves `source_declared_number = NULL` verbatim wherever the DB has it NULL —
    never backfills, never infers.
13. Refuses unless the 17 Tier 2 target joins are `human_verified` and every
    known sibling join (§G of the final audit) is *not*.
14. Refuses unless the 53 Tier 3 frozen-sample segments' immutable fields (text,
    hash, ordinal, declared number, alignment_type, canonical targets) match
    `PHASE5-TIER3-FROZEN-SAMPLE.json` exactly.
15. Refuses on any `alignment_status`/`alignment_type`/`mapping_confidence`/
    `segment_type` value outside the closed domains in §E.
16. Refuses if any join's `(surah_number, ayah_number)` doesn't resolve against
    `ayahs`.
17. **Sort order** — `segments`: `(surah_number ASC, source_ordinal ASC)`;
    `joins`: `(surah_number ASC, segment_key's source_ordinal ASC, ayah_number ASC)`.
    This is the same order the aggregate hash is computed in, so the artifact's own
    internal ordering is provably the same ordering its hash certifies — no
    "hash was computed one way, file is sorted another way" gap.

---

## 10. Migration vs import separation (§I)

**Recommendation: Option A — schema migration + deterministic import script,
not embedded SQL data.**

| | Option A: schema + import script | Option B: schema + generated SQL data migration | Option C: schema + seed-artifact import |
|---|---|---|---|
| Transactionality | Script wraps the whole import in one transaction, controlled by application code | A single giant `INSERT` migration is one transaction, but 6,396 rows of literal SQL is unreviewable by a human and painful to diff | Same transactional guarantee as A, artifact is just JSON instead of a script |
| Auditability | High — the artifact (§8) is diffable, hashable, human-inspectable JSON, separate from the code that applies it | Low — a multi-thousand-line generated SQL file is not meaningfully reviewable | High — same as A |
| Reproducibility | Artifact regenerates byte-identically from the same 3 inputs; script is idempotent (§13) | Regenerating means regenerating SQL, indistinguishable from an edit | Same as A |
| Rollback | Source-scoped script, straightforward (§Q) | Would need a hand-written down-migration for thousands of rows | Same as A |
| Supabase/CLI timeout behavior | A single `supabase db push` migration inserting ~6,400 rows via literal `INSERT` statements risks a large single-statement payload; a script-driven import can batch/chunk and doesn't route through the CLI's migration-apply path at all | Same large-payload risk as A but *worse* because it's forced through the migration pipeline specifically | Avoids the migration pipeline for data entirely, same batching flexibility as A |
| Cloudflare independence | Import runs against Supabase directly (like every other migration in this project's history), unrelated to the Cloudflare Worker deployment — no coupling either way | Same | Same |
| Idempotency | Designed explicitly in the script (§13) | Re-running a data migration either double-inserts or requires its own guard logic baked into raw SQL, error-prone at this row count | Same as A |

**Concrete split:**
- **Migration** (`supabase/migrations/<timestamp>_<uuid>.sql`): schema only — the two
  `CREATE TABLE`s, constraints, indexes, triggers, RLS policies, and the single
  `content_sources` INSERT (metadata, not the 6,239 rows). Small, reviewable,
  applies via the exact same `supabase db push --linked` path every other migration
  in this project's history has used.
- **Import**: a script (not a migration file) that reads the artifact from §8,
  connects with the same credentials the migration itself would use, and performs the
  bulk insert inside one transaction, with the precondition/postcondition guards from
  §16/§20 run as real queries before and after — not embedded as SQL `DO` blocks
  inside a giant migration, which is unreviewable at this scale.

---

## 11. ID strategy (§J)

**Recommendation: C — generate fresh production UUIDs at import time**, not (A)
preserve local prototype UUIDs, not (B) derive deterministic IDs from content.

- **Against A (preserve local UUIDs)**: the local prototype's UUIDs are an artifact
  of *when* each row happened to be inserted locally across Phases 3-5 — they carry
  no meaning, and treating them as if they must survive into production implies a
  guarantee ("this exact UUID is significant") that was never actually true. Reusing
  them also risks an accidental collision if the production database has ever
  generated a UUID that happens to match (astronomically unlikely with `gen_random_uuid()`,
  but not a risk worth taking for zero benefit).
- **Against B (deterministic IDs from content)**: would require inventing a hashing
  scheme now, adds complexity, and buys nothing — the artifact's `segment_key`
  (`surah:ordinal`) is already the natural deterministic identifier for
  cross-referencing joins to segments *within the artifact*, and that's the only
  place determinism is actually needed before the rows exist in a database.
- **For C**: production `id` columns get real `gen_random_uuid()` values, generated
  by the `INSERT` itself (matching every other table's convention in this schema —
  `content_sources`, `translations`, `ayahs` all do this). The import script captures
  the newly-generated segment IDs in memory immediately after the segment insert,
  then uses them to insert the joins in the same transaction — no `segment_key`
  round-trip needed once past the initial insert.

**Consequences**: auditability and reproducibility live in the *artifact* (§8), which
is content-addressed via its own hashes — not in the UUIDs, which is the right layer
for that guarantee to live at. Future review-item provenance (§17) references
production segment IDs going forward from the moment they're created, which is fine
since nothing references them before that moment. Re-import protection is handled by
idempotency (§13), not by ID preservation.

---

## 12. Idempotency rules (§K)

| State | Behavior |
|---|---|
| **First run** | Proceeds normally: insert `content_sources` row, insert 6,239 segments, insert 6,396 joins, all in one transaction. |
| **Re-run, source already exists, all 6,239/6,396 rows present and byte-identical** | Recompute the aggregate hash from what's *already in production*; if it matches the artifact's declared hash exactly, and counts match exactly → **safe no-op**, exit reporting "already imported, verified identical." |
| **Re-run, source exists, but some rows are missing (partial prior run)** | **STOP.** No "resume" mode in this design — partial states are rare (should only happen from an interrupted transaction, which Postgres itself would have already rolled back) and dangerous to auto-resume without knowing why the prior run stopped. Report exact counts found vs. expected; require explicit human decision before retry. |
| **Re-run, source exists, but any row's content diverges from the artifact** (different text, different hash, different mapping) | **STOP immediately.** Never overwrite. This is the single most important rule — a diverging row means either the artifact changed (in which case *why* needs a human answer) or production was touched out-of-band (in which case that needs investigation before anything else happens). |
| **Unknown/unexpected existing Kazimirski-like rows** (e.g. a `content_sources` row with a similar `edition_identifier` the importer didn't create) | **STOP.** Never assume it's safe to ignore or merge with unrecognized prior state. |

Mechanically: the transaction begins with a precondition check (§19) that
classifies which of these five states production is currently in, and only the
first two proceed past that check.

---

## 13. Transaction / activation strategy (§L)

**One transaction for the entire import** (`content_sources` insert + all 6,239
segment inserts + all 6,396 join inserts), not staged across multiple transactions.
At this row count (well under typical Postgres single-transaction practical limits —
this is thousands of rows, not millions), there is no operational reason to stage,
and staging would itself introduce the exact "partial state briefly visible" risk the
gate explicitly warns against.

**No separate "activation flag" needed beyond what already exists**:
`content_sources.verification_status` already serves that role for every other
source in this schema (`'candidate'` = not yet trusted for production display logic,
`'verified'` = trusted) — Kazimirski's resolver-readiness gate (§14, when eventually
implemented) should key off `verification_status = 'verified'`, not a new bespoke
flag. Since this design recommends inserting it as `'candidate'` (§7), the data is
present and queryable immediately after import but not yet eligible for the future
resolver to serve to real users until that status is deliberately flipped in a later,
separate, explicit action — a second natural safety gate beyond the transaction
boundary itself, costing nothing new to build.

**What must never be visible**: a `content_sources` row with fewer than 6,239
segments or fewer than 6,396 joins, at any point a concurrent reader could observe it
— guaranteed by the single-transaction design (Postgres's own MVCC visibility rules
mean no other session sees any of this transaction's rows until it commits).

---

## 14. Future French resolver contract (§N) — contract only, not implemented

```
content_sources (Kazimirski, verification_status check happens here)
        ↓
translation_segments      (by surah_number, ordered by source_ordinal)
        ↓
translation_segment_ayahs (by surah_number, ayah_number)
        ↓
resolver function          (new, not built in this phase — mirrors the existing
                             per-surah shape of fetchTranslationsForSurah)
        ↓
Reader / Memorization / Lessons (not touched in this phase)
```

**Rendering semantics, fixed now so the schema never blocks them later:**
- **`direct`/`offset`**: exactly one segment, one join — render as-is.
- **`one_to_many`**: render the segment's text **once**, spanning the joined āyah
  range (its `MIN`/`MAX` ayah_number among its own joins) — never duplicated once per
  joined āyah.
- **`many_to_one`**: render every segment joined to that āyah, concatenated in
  `source_ordinal` ASC order, each retaining a visible boundary marker.
- **`compound`**: rendered via the *same* two rules above, applied per join row —
  the schema's design (§C, §J of the mapping-architecture doc) already proved
  compound cases need no special-case code, only the generic one_to_many/many_to_one
  rules applied together on the same āyah.

Nothing in §3's schema blocks any of this — the resolver's only real requirement is
`ORDER BY source_ordinal`, which the recommended index (§4) already serves directly.

---

## 15. Review provenance contract (§O) — contract only

Future code can determine, from the database alone (no external JSON ledger
required going forward):
- **Source provenance**: `content_sources` row for Kazimirski (§7).
- **Segment review status**: `translation_segments.alignment_status` +
  `reviewed_by` + `reviewed_at` + `reviewer_notes`.
- **Mapping review confidence**: `translation_segment_ayahs.mapping_confidence` +
  its own `reviewed_by`/`reviewed_at`/`reviewer_notes` (the exact gap Phase 5 found
  and this design closes, §3).

**Future `review_items` provenance** (not implemented now, schema left ready):
Phase 2's design already specified `review_items.translation_source_id` (FK to
`content_sources`) and `review_items.translation_segment_ids` (`uuid[]`, ordered) as
additive, nullable columns — nothing in this design changes that plan; the new
`translation_segments`/`translation_segment_ayahs` tables are exactly what those
future array elements would reference once that migration is written (separately,
later, not in this phase).

---

## 16. Local rehearsal plan (§P)

| Step | Action | PASS criteria |
|---|---|---|
| 1 | Reset local DB to a clean state, reapply every migration from scratch (`supabase db reset` against local only) | All existing migrations apply with zero errors |
| 2 | Verify baseline | `ayahs` = 6,236, `translations` (Pickthall) = 6,236, zero Kazimirski rows |
| 3 | Generate the import artifact from the frozen inputs (§9) | Generator exits 0, artifact hashes match §8's declared values |
| 4 | Validate the artifact standalone (re-parse it, recompute both hashes from its own contents, recheck counts) | Hashes/counts self-consistent, matches the frozen manifest's own numbers |
| 5 | Apply the schema migration (locally only) | Both tables, all constraints/triggers/RLS created with zero errors; `ayahs`/`translations` counts unchanged |
| 6 | Run the import script against the freshly-migrated local DB | Transaction commits; postconditions (§20) all pass |
| 7 | Verify complete imported state | 6,239 segments, 6,396 joins, 6,236/6,236 coverage, 57 human_verified segments, 80 human_verified joins, 17 Tier 2 human_verified joins, aggregate hash matches, canonical Arabic/Pickthall untouched |
| 8 | Re-run the importer immediately | Reports "already imported, verified identical," zero new rows, zero errors (§13's no-op path) |
| 9 | On a **disposable** copy only: hand-edit one segment's `text` directly in the DB, then re-run the importer | Importer detects the divergence and **STOPS** — refuses to overwrite, reports exactly which row diverged |
| 10 | Run resolver-level prototype checks (the existing local-prototype `resolver.ts` from Phase 3, read-only queries) | All 15 existing resolver tests still pass against the newly-imported production-shaped data |
| 11 | Run the existing app test suite (`npm run test:unit`, lint, build; full E2E if any of the above touched `src/`, which this phase doesn't) | All green, zero regressions, since nothing in `src/` changes in this design phase |
| 12 | Re-verify canonical Arabic/Pickthall | Still exactly 6,236/6,236, content hash unchanged (reuse the §D methodology from Phase 5's own final audit) |
| 13 | Produce a rehearsal evidence report | Every step above has a recorded PASS, saved as its own artifact before production is ever touched |

This rehearsal is **mandatory and unstarted** — it belongs to the *next* gate
(implementation), not this design phase.

---

## 17. Rollback design (§Q)

**Source-scoped only, never broad.** If the Kazimirski import needs reverting:

```sql
-- 1. Delete Kazimirski's joins first (FK ON DELETE RESTRICT on segment_id means
--    segments can't be deleted while joins reference them, so order matters).
DELETE FROM translation_segment_ayahs
  WHERE segment_id IN (SELECT id FROM translation_segments WHERE source_id = '<kazimirski source_id>');

-- 2. Delete Kazimirski's segments.
DELETE FROM translation_segments WHERE source_id = '<kazimirski source_id>';

-- 3. Delete (or, preferably, deactivate) the content_sources row.
--    Prefer deactivation (verification_status = 'deprecated') over deletion --
--    matches this project's own established preference (the fr.hamidullah-crf
--    remediation preserved its disputed source row rather than deleting it).
UPDATE content_sources SET verification_status = 'deprecated' WHERE id = '<kazimirski source_id>';
```

Every statement is scoped by `source_id = '<kazimirski>'` — structurally incapable of
touching `ayahs`, `translations`, or any other `content_sources` row, since none of
those tables have any FK path back to a `translation_segments.source_id` value.
`ON DELETE RESTRICT` (§3) is exactly what makes step 1 mandatory before step 2 and
prevents any accidental cascade beyond Kazimirski's own rows.

---

## 18. Production preconditions (§R)

Before any future implementation gate may apply the migration or run the import,
verify (mirroring exactly the precondition-guard pattern already proven in the
`fr.hamidullah-crf` migration):

```
- Exactly one pending migration matches this design's schema migration (no
  unrelated pending migration)
- Canonical ayahs = 6,236
- Pickthall = 6,236
- Zero existing rows in translation_segments/translation_segment_ayahs, OR the
  exact idempotent-match state from §13
- Approved raw source SHA256 = 38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92
- Approved aggregate segment hash = 12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26
- Import artifact's own self-computed hashes match both of the above
- Artifact declares 6,239 segments
- Artifact declares 6,396 joins
- Artifact declares 6,236/6,236 coverage
- All 25 Phase 5 decisions are APPROVE (re-read PHASE5-REVIEW-DECISIONS.json fresh,
  not cached)
- Artifact reconciles to 57 human_verified segments
- Artifact reconciles to 80 human_verified joins
- No forbidden source collision (no existing content_sources row with the same
  edition_identifier that isn't this exact one)
```

---

## 19. Production postconditions (§S)

After the eventual import, verify (all independently re-queried, not inferred from
the import script's own claimed success):

```
- Exactly one Kazimirski content_sources row
- translation_segments count = 6,239
- translation_segment_ayahs count = 6,396
- Canonical coverage = 6,236/6,236 (via DISTINCT (surah,ayah) over the joins)
- Zero segments with alignment_status = 'unresolved'
- human_verified segments = 57
- human_verified joins = 80
- Tier 2 target joins (the 17 specific (surah,ayah) pairs) human_verified = 17
- Aggregate segment text hash, recomputed from the live table, = 12015b8f...
- Raw source provenance fields on the content_sources row match §7 exactly
- Canonical ayahs still = 6,236, content hash unchanged (§D methodology)
- Pickthall still = 6,236, zero rows changed
- No unrelated translations/content_sources row was touched (row-count diff
  across every other table against a pre-import snapshot)
- RLS active and correctly scoped (SELECT works for anon; INSERT/UPDATE/DELETE
  fails for anon and authenticated)
- A read-only resolver-shaped query (e.g. "all segments+joins for surah 101 in
  source_ordinal order") produces deterministic, repeatable results across
  multiple runs
```

---

## 20. Threat / failure analysis (§T)

| Failure mode | Preventive control |
|---|---|
| Wrong source artifact used | Generator recomputes `raw_source_sha256` from the actual file at generation time (§9.3); precondition re-checks it again before any DB write (§18) |
| Stale manifest | Generator's `manifest_hash` pins the exact manifest version; any manifest edit after artifact generation produces a hash mismatch, caught before import |
| Malformed mapping | Generator refuses on any out-of-domain enum value, orphaned join, or coverage gap (§9.7, .15, .16) — never silently coerced |
| Duplicate segment | `UNIQUE(source_id, surah_number, source_ordinal)` — DB-enforced, cannot occur |
| Duplicate join | `UNIQUE(segment_id, surah_number, ayah_number)` — DB-enforced |
| Partial import (service interruption mid-transaction) | Single transaction (§13) — Postgres rolls back automatically; re-run hits the "partial state" branch of §13 and stops for human review, never silently resumes |
| Accidental canonical Arabic mutation | Import script has no code path that writes to `ayahs` at all (schema review, §3, confirms no FK requires it); postcondition re-verifies count+hash independently (§19) |
| Accidental Pickthall mutation | Same — no code path touches `translations`; postcondition re-verifies |
| UUID drift between rehearsal and production | Not a risk under the chosen ID strategy (§11) — fresh UUIDs are *expected* to differ between environments; nothing depends on them matching |
| Review metadata drift (DB vs. `PHASE5-REVIEW-DECISIONS.json`) | Generator's gates 8-11 (§9) reconcile the ledger against the DB at generation time, catching drift before it ever reaches an artifact |
| Production timeout on a large single statement | Single transaction, but batched `INSERT`s (multi-row `VALUES` in reasonably-sized chunks, e.g. 500 rows/statement) inside that one transaction rather than one 6,396-row statement — avoids any single-statement payload limit without sacrificing atomicity |
| Second importer execution (accidental re-run) | Idempotency rules (§13) — safe no-op on exact match, hard stop on any divergence |
| Schema/import version mismatch | Artifact's `schema_version` field is checked by the import script before it attempts any insert; mismatch refuses immediately |
| RLS accidentally blocking legitimate reads | Postcondition explicitly tests an anon-key `SELECT` succeeds (§19) |
| RLS accidentally permitting writes | Postcondition explicitly tests an anon-key `INSERT` fails (§19) |
| Resolver duplicate rendering (double-showing a one_to_many segment) | Contract fixed now (§14: "render once, spanning the range") so this is a resolver-implementation bug to catch in that future phase's own tests, not something the schema itself can prevent structurally — flagged here so that future phase inherits the requirement explicitly, not as an afterthought |

---

## 21. Unresolved design questions (§22 in the outline — kept here as required)

These do **not** block writing the migration/importer code, but at least the first
one blocks *applying* it to production:

1. **`verification_status` for the Kazimirski `content_sources` row**: this design
   recommends `'candidate'` (§7) because Phase 5 validated *alignment mechanics*, not
   *translation-quality/scholarly accuracy* in the sense `'verified'` implies
   elsewhere in this schema (matching Pickthall's bar). **A human decision is needed
   on whether Phase 5's review clears that bar, or whether a distinct
   translation-quality review is still required before `'verified'` is appropriate.**
2. **Resolver activation gating**: should the future resolver check
   `verification_status = 'verified'` specifically, or is `'candidate'` intended to
   be resolver-eligible for Kazimirski specifically (given its provenance is
   unusually well-documented compared to a typical "candidate")? This doesn't block
   schema/import work now, only the later resolver-implementation phase.
3. **Batch size for the chunked `INSERT`s** in §20's timeout mitigation — a specific
   number (proposed 500) should be confirmed against actual Supabase/Postgres
   statement-size behavior during the rehearsal (§16), not fixed permanently here.

None of these require re-opening Phase 5's human review, and none require touching
canonical Arabic or Pickthall.

---

## 22. Explicit GO/NO-GO recommendation

**GO for implementation** (writing the actual migration file, the generator script,
and the importer script, all still local/design-adjacent work) **once question 1
above is answered** — everything else in this document is fully specified and ready.
**NO-GO for production application** until the full rehearsal (§16) has actually run
and produced a PASS evidence report, per this project's own established pattern for
every migration in its history.
