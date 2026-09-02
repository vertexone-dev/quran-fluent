# Kazimirski French Translation — Phase 2: Mapping Architecture + Import Design

**Status: DESIGN ONLY. No migration written or applied. No import. No production or
database writes of any kind. No deploy.** Everything below is a design specification,
built from the Phase 1 audit (`PHASE1-ALIGNMENT-AUDIT.md`, `surah_alignment_matrix.csv`,
`segment_classification_full.csv`) and the current, real schema of `content_sources`,
`translations`, `ayahs`, and `review_items` (inspected directly against the local
Supabase instance, which mirrors production, immediately before writing this document).

---

## 1. Data model

### `translation_segments`

One row per physical Kazimirski source unit — a numbered `<li>` item, or (new) an
unnumbered preamble unit like Al-Fatiha's Bismillah. Holds his exact text, never
canonical Arabic.

```sql
CREATE TABLE public.translation_segments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                uuid NOT NULL REFERENCES public.content_sources(id),
  surah_number             integer NOT NULL REFERENCES public.surahs(number),

  segment_type             text NOT NULL DEFAULT 'numbered'
                              CHECK (segment_type IN ('numbered', 'unnumbered_preamble')),

  -- Physical extraction position within the surah, 1-based, gapless, always present.
  -- This is the SOURCE OF TRUTH for rendering/concatenation order -- it reflects where
  -- the segment actually sits in Kazimirski's book, independent of whether his own
  -- printed verse number (below) is trustworthy for that surah.
  source_ordinal           integer NOT NULL,

  -- Kazimirski's own printed verse number, where the segment has one. Nullable because
  -- an unnumbered preamble has none, and because it can legitimately diverge from
  -- source_ordinal once an unresolved extra segment (Surah 2, Surah 36) exists past it --
  -- that divergence is signal, not something to paper over by forcing them equal.
  source_declared_number   integer,

  text                     text NOT NULL CHECK (btrim(text) <> ''),
  text_sha256              text NOT NULL,

  -- Traceability back to the frozen raw artifact this segment was extracted from
  -- (e.g. a byte range in texte_entier_raw.html, or a Page-namespace URL for the
  -- Surah 91 special case) -- not a rendering concern, purely an audit trail.
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

CREATE INDEX translation_segments_surah_idx
  ON public.translation_segments (surah_number, source_ordinal);
CREATE INDEX translation_segments_status_idx
  ON public.translation_segments (alignment_status)
  WHERE alignment_status IN ('unresolved', 'human_verified');

-- Immutability: once text is written, it may never change silently. Alignment
-- classification, status, and reviewer fields remain mutable (that IS the review
-- workflow); the text itself and its hash do not, mirroring the project's standing
-- "never modify translation wording" rule at the database layer, not just by convention.
CREATE FUNCTION public.translation_segments_text_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.text IS DISTINCT FROM OLD.text OR NEW.text_sha256 IS DISTINCT FROM OLD.text_sha256 THEN
    RAISE EXCEPTION 'translation_segments.text is immutable once written (segment %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER translation_segments_text_immutable_trg
  BEFORE UPDATE ON public.translation_segments
  FOR EACH ROW EXECUTE FUNCTION public.translation_segments_text_immutable();

CREATE TRIGGER translation_segments_updated_at
  BEFORE UPDATE ON public.translation_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.translation_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segments_read_all ON public.translation_segments
  FOR SELECT TO anon, authenticated USING (true);
-- No INSERT/UPDATE/DELETE policy for anon/authenticated, matching translations and
-- content_sources exactly: writes only via migration / service role, never the client.
```

### `translation_segment_ayahs`

The join table. One row per (segment, canonical āyah) association.

```sql
CREATE TABLE public.translation_segment_ayahs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id        uuid NOT NULL REFERENCES public.translation_segments(id) ON DELETE RESTRICT,
  surah_number      integer NOT NULL,
  ayah_number       integer NOT NULL,

  -- Per-mapping confidence, distinct from the segment's own alignment_status: a
  -- compound-boundary segment (§4.6 of the Phase 1 audit) can have one join row that's
  -- solid and another for the same segment that genuinely needs a human decision.
  mapping_confidence text NOT NULL DEFAULT 'auto'
                        CHECK (mapping_confidence IN ('auto', 'cross_verified', 'human_verified', 'needs_review')),

  created_at        timestamptz NOT NULL DEFAULT now(),

  FOREIGN KEY (surah_number, ayah_number)
    REFERENCES public.ayahs (surah_number, ayah_number) ON DELETE RESTRICT,
  UNIQUE (segment_id, surah_number, ayah_number)
);

CREATE INDEX translation_segment_ayahs_ayah_idx
  ON public.translation_segment_ayahs (surah_number, ayah_number);
CREATE INDEX translation_segment_ayahs_segment_idx
  ON public.translation_segment_ayahs (segment_id);

ALTER TABLE public.translation_segment_ayahs ENABLE ROW LEVEL SECURITY;
CREATE POLICY translation_segment_ayahs_read_all ON public.translation_segment_ayahs
  FOR SELECT TO anon, authenticated USING (true);
```

**Deliberately no stored `segment_order_in_ayah` column.** For a many:1 (D) or
compound ayah with several segments, render order is always `translation_segments
.source_ordinal ASC` for that ayah's joined segments — Kazimirski's own physical
order, which is also the correct semantic order. Storing a second, separate order
column would just be a second invariant that could drift from the first; deriving it
at query time from the one column that's already the source of truth is safer and
simpler.

**Deletion behavior**: `ON DELETE RESTRICT` throughout, exactly matching how
`translations` already relates to `ayahs` — a segment or āyah can't be silently
removed out from under an existing mapping; removing one requires deliberately
unlinking the join rows first.

**RLS**: identical shape to `content_sources`/`translations` — public read, no
client write path. Nothing here is user-scoped data.

---

## 2. Alignment taxonomy

Using exactly the two enums specified, since they already cleanly separate two
orthogonal questions — *what kind of mapping is this* vs. *how much do we trust it*
— rather than conflating them into one status field:

**`alignment_type`** (segment-level; what pattern from the Phase 1 audit this is):

| Value | Meaning | Audit letter | Join rows produced |
|---|---|---|---|
| `direct` | 1 segment : 1 āyah, declared number matches canonical number | A | 1 |
| `offset` | 1 segment : 1 āyah, but Kazimirski's declared number differs from canonical due to the documented Flügel↔Cairo numbering shift | B | 1 |
| `one_to_many` | this segment's text spans 2+ canonical āyahs | C | 2+ |
| `many_to_one` | this segment is one of 2+ segments that all join to the same āyah | D | 1 (but siblings exist) |
| `compound` | participates in one of the 8 boundary āyahs that are simultaneously a split target and a merge target (§4.6) | mixed C+D | varies, always `needs_review` |
| `unresolved` | segment physically exists, canonical target not yet determined | E | 0 |
| `source_anomaly` | present in the source but structurally outside the normal numbered list (Fatiha's Bismillah) | F | 1 |

**`alignment_status`** (governs how much the mapping can be trusted, independent of
its type):

| Value | Meaning |
|---|---|
| `auto_verified` | produced only by the automated concordance-cross-validation pipeline; no direct French read of this specific segment |
| `cross_verified` | confirmed by at least one additional independent automated signal beyond the base pipeline (e.g. the concordance PDF's own published summary statistics matching the independently-computed split, as happened at the whole-surah level for all 114 surahs in Phase 1) |
| `human_verified` | a French-literate reviewer directly read Kazimirski's text against a canonical French Quran reference and confirmed the mapping — required before import eligibility |
| `unresolved` | no confident mapping exists |
| `rejected` | a previously proposed mapping a reviewer determined was wrong; the row is kept (never deleted) with `reviewer_notes` explaining why, for audit-trail integrity, and superseded by a corrected row |

No free-text status field is used anywhere a `CHECK`-constrained enum can express the
same information — matching this project's standing preference (`content_sources
.verification_status` already works this way).

---

## 3. Al-Fatiha 1:1 (Bismillah) representation

One new `translation_segments` row per surah that needs it (currently only Surah 1):

```
segment_type:           'unnumbered_preamble'
source_ordinal:          0          -- sorts before item 1, never collides with a numbered item
source_declared_number:  NULL       -- Kazimirski never numbered it -- do not invent a "1"
text:                    'Au nom du Dieu clément et miséricordieux'   -- verbatim
alignment_type:          'source_anomaly'
```

with exactly one `translation_segment_ayahs` row: `(surah_number=1, ayah_number=1)`.

This satisfies every stated requirement: the text is preserved exactly where it
occurs (extracted from its actual position, outside the `<ol>`), marked distinctly
(`unnumbered_preamble`, not silently folded into `numbered`), mapped to canonical
1:1, and at no point does the record claim Kazimirski numbered it "1" — his own
numbering starts at "Louange à Dieu" (canonical 1:2), and `source_declared_number`
stays `NULL` to say so honestly.

**CLOSES 6236 COVERAGE: YES.** This is a straightforward *extraction pipeline*
addition (capture the text that already exists outside the `<ol>`), not an editorial
invention — the French words are real, present, and already digitized; only their
un-numbered-ness needed a place to live in the schema, which the `unnumbered_preamble`
segment type now provides.

---

## 4. Surah 2 / Surah 36 unresolved representation

Both segments get a normal `translation_segments` row (`source_ordinal = 287` for
Surah 2, `84` for Surah 36 — their actual physical position), with:

```
alignment_type:    'unresolved'
alignment_status:  'unresolved'
```

and **zero** `translation_segment_ayahs` rows. No candidate-mapping side table is
needed for this — the segment simply exists with no join yet, which is exactly
representable by the join table's normal cardinality (0 is a valid count, same as
any segment before it's been mapped at all during import staging). Adding a separate
"candidate" mechanism would be additional schema for a case (2 segments, currently)
that doesn't need it; if a future reviewer proposes a specific candidate mapping
before confirming it, that's better tracked in `reviewer_notes` as free text pending
confirmation, not as a parallel structural table.

**Hard rule for the importer**: never auto-promote a row from `alignment_status =
'unresolved'` to any join row without a human explicitly setting `alignment_status =
'human_verified'` first (§14). The importer must treat "zero join rows" and
"unresolved status" as the *only* correct representation of not-yet-known — it must
never write a best-guess join row itself, under any circumstance.

---

## 5. One-to-many (C) representation

One `translation_segments` row (Kazimirski's exact text, once) +
N `translation_segment_ayahs` rows, one per canonical āyah it covers.

```
translation_segments:
  id=X, surah=101, source_ordinal=1, text="LE COUP. Qu'est-ce que le coup ?"

translation_segment_ayahs:
  (segment_id=X, surah=101, ayah=1)
  (segment_id=X, surah=101, ayah=2)
```

The French text is stored **exactly once** — the two join rows both point at the
same `segment_id`; nothing is duplicated, nothing is split. Rendering order/grouping
is derived by the resolver: given a `(surah, ayah)` pair, if the returned segment's
`id` also appears against other `ayah_number`s for that surah, the Reader knows this
is a shared segment and can compute the full covered range (`MIN`/`MAX` ayah_number
across all join rows sharing that `segment_id`) to render it once, spanning that
range, rather than once per row.

---

## 6. Many-to-one (D) representation

The reverse: N `translation_segments` rows (each of Kazimirski's own separately
numbered items, verbatim, never concatenated in storage) + N
`translation_segment_ayahs` rows, all pointing at the same canonical `(surah,
ayah)`.

```
translation_segments:
  id=A, surah=74, source_ordinal=31, text="Nous n'avons établi pour gardiens..."
  id=B, surah=74, source_ordinal=32, text="Et que les hommes des Écritures..."
  id=C, surah=74, source_ordinal=33, text="Afin que ceux dont le cœur..."
  id=D, surah=74, source_ordinal=34, text="Il en est ainsi. Dieu égare..."

translation_segment_ayahs:
  (segment_id=A, surah=74, ayah=31)
  (segment_id=B, surah=74, ayah=31)
  (segment_id=C, surah=74, ayah=31)
  (segment_id=D, surah=74, ayah=31)
```

Each of the 4 original printed sentences stays a distinct, independently-provenanced
row — nothing is silently concatenated in the database. The Reader concatenates them
**only at render time**, in `source_ordinal` order (31→34), with a visible boundary
marker between them so a reader can tell these were four separate printed items, not
Kazimirski's single continuous phrasing for one verse. Source boundaries stay fully
recoverable by querying the segments directly.

---

## 7. Compound cases

The model needs **no schema change** for these — they're representable with the
exact same two tables, just combining the C and D patterns on the *same* canonical
āyah simultaneously, with `mapping_confidence = 'needs_review'` on the affected join
rows to flag that the split point isn't yet editorially confirmed.

Worked example, Surah 106 (item 3 splits into 106:3+106:4; item 4 also targets 106:4):

```
translation_segments:
  id=P, surah=106, source_ordinal=3, text="Qu'ils servent le Dieu de ce temple..."
  id=Q, surah=106, source_ordinal=4, text="Et qui les a délivrés des alarmes."

translation_segment_ayahs:
  (segment_id=P, surah=106, ayah=3, mapping_confidence='cross_verified')
  (segment_id=P, surah=106, ayah=4, mapping_confidence='needs_review')   -- the disputed boundary
  (segment_id=Q, surah=106, ayah=4, mapping_confidence='needs_review')
```

74:31's 4-segment→1-ayah case is a pure D case (§6) and needs no compound handling
at all — it's already fully representable, which the Phase 1 audit already
demonstrated. **No per-surah special-case application code is required anywhere** —
every one of the 8 compound āyahs, and 74:31, reduces to ordinary rows in these two
tables with the existing enum values; the "specialness" lives entirely in data
(`alignment_type = 'compound'`, `mapping_confidence = 'needs_review'`), not in code
paths.

---

## 8. Importer design

**Inputs**:
- **A. Immutable raw extraction** — the frozen artifacts already produced in Phase 1
  (`texte_entier_raw.html`, `kazimirski_li_texts.json`, and the Surah-91
  Page-namespace fetch) treated as version-pinned once approved: the importer records
  `sha256(texte_entier_raw.html)` as `source_artifact_version` and refuses to run
  against a raw artifact whose hash doesn't match what the alignment manifest (below)
  was generated from.
- **B. Alignment manifest** — the reviewable JSON artifact defined in §10, the
  *only* place mapping decisions live. Never embedded in migration SQL.
- **C. Source metadata** — the `content_sources` row fields for Kazimirski
  (translator, edition, license, provenance — all already established as public
  domain in Phase 1), following the exact same registration pattern already used for
  Pickthall and for the disputed-Hamidullah remediation.

**Stages** (each a hard gate — the importer halts at the first failure, exactly
mirroring the precondition/postcondition `DO $$ ... RAISE EXCEPTION $$` pattern
already used in this project's migrations, e.g. the fr.hamidullah-crf remediation):

```
1. PARSE            re-parse the frozen raw artifact fresh; must produce exactly
                     6,240 physical segments across 114 surahs (or whatever count
                     the manifest declares as current) -- any drift from the
                     manifest's own recorded segment count aborts immediately.

2. VALIDATE SOURCE   for each surah: extracted segment count must equal the
   COUNTS/ORDER      manifest's declared count for that surah; source_ordinal must
                      be gapless 1..N (or 0..N when an unnumbered_preamble exists);
                      no duplicate source_ordinal within a surah.

3. LOAD MANIFEST     parse the alignment manifest; verify its own
                      source_artifact_sha256 matches the freshly-computed hash from
                      stage 1 -- if the raw artifact changed since the manifest was
                      reviewed, abort. This is the single most important guard: it
                      makes "the manifest a human reviewed" and "the manifest the
                      importer runs" provably the same object.

4. VALIDATE MAPPINGS every canonical_targets entry must reference a real
                      (surah_number, ayah_number) that exists in `ayahs`; every
                      segment referenced by the manifest must exist in the parsed
                      extraction (stage 1) with matching text_sha256; no segment
                      may be silently absent from the manifest (every one of the
                      6,240 must have an explicit manifest entry, even if that
                      entry's alignment_status is 'unresolved' with zero targets).

5. WRITE SEGMENTS    insert translation_segments rows exactly as the manifest
                      declares -- text, hashes, alignment_type/status, ordinal.

6. WRITE JOINS        insert translation_segment_ayahs rows for every
                      canonical_targets entry in the manifest.

7. INTEGRITY          re-derive: canonical āyahs covered (via the join table) must
   VERIFICATION       equal the manifest's own declared coverage count; aggregate
                      ordered hash (§9) of the just-written segments must match the
                      manifest's declared aggregate hash; per-surah segment counts
                      in the DB must match the manifest again (post-write, not just
                      pre-write); zero orphaned join rows (every join row's
                      segment_id must resolve).
```

**Abort conditions** (non-exhaustive list made exhaustive against every case named
in the gate):

| Condition | Caught at stage |
|---|---|
| missing source segment (manifest references a segment the fresh extraction doesn't have) | 4 |
| duplicated source segment (same surah+ordinal twice) | 2 |
| unknown canonical āyah (manifest targets a `(surah,ayah)` not in `ayahs`) | 4 |
| unexpected source count (extraction segment count ≠ manifest's declared count, per-surah or total) | 2 |
| alignment manifest mismatch (manifest's own source_artifact_sha256 ≠ freshly computed) | 3 |
| lost source text (any segment's re-computed `text_sha256` ≠ manifest's declared hash) | 4 |
| accidental source-text normalization (same as above — a hash mismatch is exactly what over-eager cleanup/normalization would produce) | 4, 7 |
| unexplained canonical coverage (post-write covered-āyah count ≠ manifest's declared coverage) | 7 |
| mapping cardinality mismatch (a segment declared `direct`/`offset` ends up with ≠1 join row, or `unresolved` ends up with >0 join rows) | 6, 7 |

**"Do not silently repair data"** is enforced structurally, not just by policy: every
stage either passes exactly or raises and halts — there is no fallback/best-effort
branch anywhere in this design. This mirrors the fr.hamidullah-crf remediation
migration's own precondition/postcondition pattern, which is already proven in this
codebase's actual production history.

---

## 9. Source text integrity strategy

- **Deterministic source artifact**: `texte_entier_raw.html` (plus, for Surah 91
  specifically, the direct Page-namespace fetch) is frozen the moment it's approved
  for import — re-fetching Wikisource at import time is explicitly *not* part of the
  pipeline; the importer only ever re-parses the already-frozen local file. This
  avoids the obvious risk of Wikisource content silently changing between audit and
  import.
- **`source_artifact_version`**: `sha256` of the frozen raw HTML file (and, if the
  Surah 91 fetch is kept as a separate file, its own hash too — both recorded).
  Stored on the Kazimirski `content_sources` row (in `notes`, following the existing
  convention used for the disputed-Hamidullah source's provenance notes) and inside
  the alignment manifest.
- **Per-segment hash**: `text_sha256 = sha256(text)` computed over the exact bytes
  stored in `translation_segments.text`, after only the allowed normalizations
  below. Stored on both the manifest entry and the DB row; the importer recomputes
  and compares both at write time (stage 4) and again post-write (stage 7).
- **Aggregate ordered hash**: `sha256(segment_1.text || '\x1e' || segment_2.text ||
  '\x1e' || ... )` across all segments in `(surah_number, source_ordinal)` order
  (using an unambiguous, non-printable delimiter so no real French text could ever
  produce a collision) — one fingerprint that changes if *any* segment's text or
  relative order changes, even by one character. Recorded in the manifest as the
  single number a human reviewer needs to re-verify "the thing I approved is the
  thing that got imported."

**Allowed normalization** (the only transformations permitted between raw HTML and
stored `text`):
1. HTML entity decoding (`&eacute;` → `é`, etc.) — a lossless encoding fix, not a
   content change.
2. Unicode NFC normalization — canonicalizes equivalent code-point sequences,
   doesn't change what character is represented.
3. Trimming leading/trailing whitespace introduced by HTML formatting (not
   whitespace that's part of Kazimirski's own punctuation/line breaks within a
   segment).

**Explicitly NOT allowed, ever**: modernizing his spelling or accents, "fixing"
apparent typos, altering or adding punctuation, changing capitalization, correcting
what looks like an OCR artifact (contrast with §0.2 of the Phase 1 audit, where a
typo in the *third-party 2007 concordance PDF* was corrected — that correction lives
only in *our own classification metadata*, never in a quoted Kazimirski segment).
Any transformation not on the allowed list is, by definition, a content modification
and is out of scope for this importer entirely.

---

## 10. Alignment manifest format

A single reviewable JSON file, generated from `segment_classification_full.csv` plus
human sign-offs, and treated as the **sole authoritative mapping artifact** — nothing
about *which segment maps to which āyah* is ever encoded directly in migration SQL.

```jsonc
{
  "source_artifact_sha256": "…",
  "source_artifact_paths": ["texte_entier_raw.html", "page_ns_surah91.html"],
  "generated_at": "2026-09-01T00:00:00Z",
  "generator_version": "phase2-manifest-v1",
  "aggregate_ordered_hash": "…",
  "total_segments": 6240,
  "total_canonical_ayahs_covered": 6236,

  "segments": [
    {
      "surah_number": 101,
      "source_ordinal": 1,
      "source_declared_number": 1,
      "segment_type": "numbered",
      "text": "LE COUP. Qu'est-ce que le coup ?",
      "text_sha256": "…",
      "extraction_source_ref": "texte_entier_raw.html#surah-101-li-1",
      "alignment_type": "one_to_many",
      "alignment_status": "human_verified",
      "canonical_targets": [
        { "surah_number": 101, "ayah_number": 1, "mapping_confidence": "human_verified" },
        { "surah_number": 101, "ayah_number": 2, "mapping_confidence": "human_verified" }
      ],
      "evidence": "Natural clause boundary in Kazimirski's own punctuation; matches real Quran 101:1-2 division; cross-verified against Flügel/Cairo concordance.",
      "reviewer_notes": null,
      "reviewed_by": null,
      "reviewed_at": null
    },
    {
      "surah_number": 2,
      "source_ordinal": 287,
      "source_declared_number": null,
      "segment_type": "numbered",
      "text": "…",
      "text_sha256": "…",
      "extraction_source_ref": "texte_entier_raw.html#surah-2-li-287",
      "alignment_type": "unresolved",
      "alignment_status": "unresolved",
      "canonical_targets": [],
      "evidence": "Extra <li> beyond Kazimirski's own declared 286-verse count; word-count-drift localization inconclusive (Phase 1 §4.2).",
      "reviewer_notes": "Needs direct French sentence-by-sentence read against a verse reference; not yet scheduled.",
      "reviewed_by": null,
      "reviewed_at": null
    }
  ]
}
```

Every one of the 6,240 physical segments gets an entry — including the 2 unresolved
ones (with an empty `canonical_targets` array, never a guessed one) and the
Fatiha-preamble addition (§3) as segment 6,241 conceptually, or folded in as
`source_ordinal: 0` for Surah 1 — no segment is ever omitted from the manifest, so
"every segment accounted for" is checkable by a simple row-count diff against
`segment_classification_full.csv`.

This manifest is what a human reviewer actually reads and signs off on (§14) — the
DB migration, when eventually written, does nothing but mechanically translate an
*already-approved* manifest into `INSERT` statements plus the precondition/
postcondition guards from §8. No mapping decision is made inside SQL.

---

## 11. Reader resolution design

```
content_sources (Kazimirski, fr)
        │
        ▼
translation_segments          (by surah_number)
        │
        ▼
translation_segment_ayahs      (by surah_number, ayah_number)
        │
        ▼
locale-aware resolver          (new: resolveKazimirskiForSurah(surahNumber), mirroring
        │                       the existing fetchTranslationsForSurah(surahNumber, sourceId)
        │                       shape exactly -- one query per surah, never per-ayah)
        ▼
Reader / Memorization / Lessons
```

For a given `(surah, ayah)`, the resolver's per-ayah result is one of:

- **1:1 (`direct`/`offset`)**: exactly one segment joined — render its text as-is.
- **1:many (`one_to_many`)**: the joined segment's `id` also appears against other
  `ayah_number`s in the same surah's join rows. Render the segment **once**, on the
  first āyah of the range it covers (its `MIN(ayah_number)` among its own join
  rows), spanning visually to the last; on the other āyahs in that range, the
  resolver returns a "covered by the segment above" marker rather than repeating
  the same French sentence per row — repeating it would misrepresent Kazimirski's
  own per-ayah granularity, which is exactly what the audit found does not exist
  for these segments.
- **Many:1 (`many_to_one`/`compound`)**: 2+ segments joined to this one āyah.
  Render them concatenated, in `source_ordinal` order, each retaining a visible
  boundary marker (matching the Phase 1 audit's own UX recommendation, §5 there).
  If any contributing join row has `mapping_confidence = 'needs_review'`, surface
  that distinctly (e.g. a small "alignment under review" affordance) rather than
  presenting it with the same confidence as a fully verified row.
- **Unresolved**: zero segments joined for this āyah (Surah 2/36's second
  discontinuity, until resolved). `resolvedTranslation = null`, but the UI string
  must be **distinct** from "no translation exists" — this is "translation exists,
  alignment pending," a materially different state a learner should be told about
  honestly rather than being shown the same generic unavailable message used for a
  surah with no French source at all. This is a new frontend string; not written in
  this design phase.
- **Unavailable**: no segment structurally covers this āyah at all (does not
  currently occur once §3's Fatiha fix lands — 6236/6236 covered). Falls through to
  the existing null → unavailable contract, unchanged.

The resolver never invents text and never silently promotes an `unresolved` segment
into a rendered answer — same "never invent, never silently fall back across
locales" contract `ayahTranslation`/`fetchAyahsWithTranslations` already enforce for
every other translation path in this codebase.

---

## 12. Memorization / review-item design

**The problem being explicitly avoided**: `review_items.back` today is a flat,
NOT-NULL text snapshot with **zero** stored provenance — exactly why the recent
fr.hamidullah-crf remediation had to identify affected rows by matching on the exact
`(item_key, back)` text pair, having no source reference to query by instead. A
segment-based French source must not recreate that gap.

**Recommendation: store both** — keep the rendered snapshot (required for the
flashcard UI to keep working with zero rendering-logic changes) **and** add
provenance columns so a future governance action never again needs to pattern-match
on rendered text:

```sql
ALTER TABLE public.review_items
  ADD COLUMN translation_source_id   uuid REFERENCES public.content_sources(id),
  ADD COLUMN translation_segment_ids uuid[];
```

Both nullable, both purely additive — `back` stays NOT NULL and unchanged in
meaning; existing rows (English Pickthall, legacy columns, the already-migrated
Hamidullah-derived rows) simply have both new columns `NULL`, which is honest
(their provenance genuinely wasn't captured going forward from here, not
retroactively fabricated).

- `translation_source_id`: which `content_sources` row produced this `back` text —
  populated for *any* governed source, not just segment-based ones (this closes the
  gap for Pickthall-derived review items too, at zero schema cost).
- `translation_segment_ids`: for a segment-based source only, the ordered array of
  contributing `translation_segments.id`s (one element for a 1:1 or 1:many segment;
  several, in render order, for a many:1/compound āyah) — lets a future audit
  re-derive exactly which segment(s) produced any existing card's `back`, without
  ever needing to string-match rendered text again.

`scheduleReview` (`src/lib/memorization.ts`) would populate these two new fields
alongside `back` whenever `ayah.resolvedTranslation` came from a governed source
(segment-based or simple `translations`-row-based); they stay `NULL` only for the
legacy inline-column path, which has no source row to reference at all.

This is an additive migration to an existing table (new nullable columns + one FK),
not a redesign of `review_items` — no existing read/write path breaks.

---

## 13. Compatibility with Pickthall

**Recommendation: Option A — segment architecture only for sources that actually
need it.** Pickthall is complete (6236/6236, `verified`), already hardened through
this engagement's own remediation work, and gains nothing from segment modeling
(every English āyah is already a clean 1:1). Migrating it to `translation_segments`
would be pure architectural symmetry with real migration risk and zero functional
benefit — directly against "prefer minimum production risk" and "do not refactor
working Pickthall merely for architectural purity."

The resolver layer gains one more fallback tier, extending (not rewriting) the
branching `fetchAyahsWithTranslations` already has:

```
1. governed `translations` (simple 1:1 sources -- Pickthall today, any future
   simple source)
2. governed `translation_segments` / `translation_segment_ayahs` (segment-based
   sources -- Kazimirski, once approved)
3. legacy inline column (`ayahs.translation_en` / `translation_fr`)
4. null → existing "unavailable" UI contract
```

`translations` and `translation_segments` are permanently allowed to coexist as two
valid governed representations, chosen per-source based on whether that source's
own structure actually requires segment modeling — not a transitional state that
needs eventual unification.

**CANONICAL ARABIC IMPACT: none, by construction** — neither table has a text
column for Arabic; both only ever reference `(surah_number, ayah_number)` identities
already defined in `ayahs`, exactly like `translations` does today.

---

## 14. Human review gate

**Review queue** (three tiers, in priority order):

1. **The 2 unresolved segments** (Surah 2 ordinal 287, Surah 36 ordinal 84) —
   `alignment_status = 'unresolved'`. Blocks nothing else; these two āyahs' second
   discontinuity stays honestly unresolved in the Reader until closed.
2. **The 8 compound-boundary āyahs** (`3:39, 3:167, 11:39, 14:44, 47:21, 65:3,
   65:10, 106:4`) and every segment/join row participating in them —
   `alignment_type = 'compound'`, join rows at `mapping_confidence = 'needs_review'`.
3. **A recommended sample of the ~74 concordance-only surahs** (Phase 1 §0.3) —
   currently `alignment_status = 'auto_verified'` with no direct French read.
   Recommend a stratified sample of at least 15–20% of these surahs (mixing short
   and long ones, and prioritizing any surah with muqattaʿat) as a starting point;
   final sample size is the reviewer's call, not something to fix here.

**What changes `alignment_status` to `human_verified`**: a named, French-literate
reviewer directly compares the segment's stored `text` against (a) the
corresponding canonical Arabic āyah(s) via an independent French Quran reference
(not solely the 2007 concordance's English gloss, which is itself a secondary
source), confirms the mapping is correct, and the review is recorded as:

```
reviewed_by:  '<reviewer name/identifier>'
reviewed_at:  <timestamptz>
reviewer_notes: '<what was checked, against what reference>'
alignment_status: 'human_verified'
```

on the `translation_segments` row (and `mapping_confidence = 'human_verified'` on
the specific join row(s), for compound cases where only part of a segment's mapping
was in question). A `rejected` outcome follows the same recording shape but with
`alignment_status = 'rejected'` and a corrected replacement row inserted separately
— the rejected row is never deleted, preserving the audit trail.

**Schema and import architecture may proceed (design/prototype only) before this
review completes. Production import may not.**

---

## Report

(See the chat response for the exact field-format report requested by the gate.)
