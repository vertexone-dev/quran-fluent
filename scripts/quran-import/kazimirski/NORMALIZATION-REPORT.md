# Kazimirski Phase 3 — Source Artifact Freeze + Normalization Report

Status: LOCAL PROTOTYPE artifact, `scripts/quran-import/kazimirski/`. No database writes.

## 1. Frozen source artifact

| File | Role | SHA-256 |
|---|---|---|
| `texte_entier_raw.html` | Primary/only source artifact for all 114 surahs, all 6,240 numbered segments, and the Surah 1 Bismillah preamble | `38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92` |

**Surah 91 special case**: Phase 1's audit (§1) flagged Surah 91's `<ol>` as
rendering without a closing `</ol>`/final `</li>` tag in the fresh fetch —
a transclusion-fragility symptom, not a missing/separate artifact. No
separate Page-namespace fetch file exists in this directory (confirmed by
directory listing); Phase 1 handled it by extracting the raw `<li>` count
directly from the same `texte_entier_raw.html`, and this Phase 3 work does
the same (`kazimirski_html_extract.py`'s `extract_li_items()` never depends
on `</ol>` being present — it terminates a surah's item list at whichever
comes first: an explicit `</ol>` close, or the next `<h3>` chapter heading).
Re-verified this session: Surah 91 fresh-extracts exactly 15 `<li>` items,
matching the audit's "Kaz Actual li = 15" for Surah 91. There is therefore
only ONE source artifact file for this phase, not two.

Segment count from fresh independent re-parse: **6,240** physical `<li>`
segments across 114 surahs (exact per-surah match against
`surah_alignment_matrix.csv`'s `kazimirski_actual_li_count` column for all
114 rows — zero mismatches).

Aggregate ordered hash (§9 of PHASE2-MAPPING-ARCHITECTURE.md: sha256 of all
6,241 manifest segment texts — the 6,240 numbered segments plus the 1
Fatiha preamble — joined by `\x1e`, in `(surah_number, source_ordinal)`
order):

```
3cbed90986a31b1e6959c7d00f4d9191dd38dcf77b5f678071fe6f3067d28101
```

## 2. Allowed normalizations — what was actually applied, and by whom

PHASE2-MAPPING-ARCHITECTURE.md §9 allows exactly three transformations
between raw HTML and stored `text`:
1. HTML entity decoding
2. Unicode NFC normalization
3. Trimming leading/trailing whitespace introduced by HTML formatting

**This session's independent extractor (`kazimirski_html_extract.py`)
applies exactly these three and nothing else**, confirmed by code review:
- Entity decoding: via `html.unescape()` on every named/numeric character
  reference encountered (`handle_entityref`/`handle_charref`), and nothing
  else touches entities.
- NFC: one explicit `unicodedata.normalize("NFC", raw)` call per segment.
- Trim: `.strip()` at the end, after collapsing HTML line-wrap whitespace
  (literal `\t`/`\r`/`\n` and runs of literal ASCII spaces introduced by the
  source file's own 80-column line wrapping) to single spaces — this last
  step is INSIDE the definition of "whitespace introduced by HTML
  formatting" (item 3), not a fourth normalization: it only touches
  characters from the class `[ \t\r\n]` (plain ASCII whitespace used for the
  document's own line-wrapping), never the French non-breaking space
  (U+00A0) that is part of Kazimirski's own typography.

**Finding: Phase 1's own `segment_classification_full.csv` and
`kazimirski_li_texts.json` applied a FOURTH, unlisted transformation** —
every U+00A0 (non-breaking space, encoded `&#160;` in the raw HTML, used
per French typographic convention before `; : ? !`) was silently collapsed
to a plain U+0020 space. This was discovered by diffing this session's
fresh extraction against both of Phase 1's artifacts: byte-for-byte
identical on content, differing ONLY in this one character substitution,
across every one of the 6,238 non-`EXTRA-1` CSV rows checked. Two
additional rows (Surah 31 item 15, Surah 60 item 6) also showed the raw
HTML itself containing a literal `" \xa0"` run (a plain space immediately
followed by a non-breaking space, e.g. `"enfant &#160;!"` — verified
present verbatim in `texte_entier_raw.html`) which Phase 1's pipeline
further collapsed to a single plain space; this is the same class of
issue, not a separate one.

**Disposition**: since collapsing U+00A0 to U+0020 is not on the allowed
list — it changes a real, distinct Unicode code point, not just formatting
— this session's manifest generator (`generate_manifest.py`) uses the
FRESH extraction (nbsp preserved) as the authoritative `text` and
`text_sha256` for every segment, not the CSV's own `french_text` column.
The CSV is used only for the ALIGNMENT decision (classification letter,
canonical ayah range) — never for literal text bytes. This is reported
here explicitly, per the task's "do not paper over, report the exact
contradiction" rule, rather than silently picking one source. See the
docstring of `generate_manifest.py` for the full reasoning and the
byte-for-byte cross-check that was run before making this call.

**Practical impact**: none on alignment/classification (Phase 1's
classification work was done against text that only differs in this one
whitespace character type, never affecting word content or ayah
boundaries). The impact is purely that `text_sha256` values in this
phase's manifest/database will not equal a hash computed from the CSV's
`french_text` column directly — which is expected and correct, and is
exactly why the aggregate ordered hash in this report is computed from the
fresh extraction, and why the importer's stage-4/stage-7 hash checks
(PHASE2-MAPPING-ARCHITECTURE.md §8) compare against the manifest's OWN
declared hash, not against the CSV.

## 3. The 2 unresolved (E) segments — text sourcing

`segment_classification_full.csv`'s two `EXTRA-1` rows (Surah 2, Surah 36)
contain a research note in the `french_text` column, not Kazimirski's
actual text. This session sourced their real text directly from the frozen
`texte_entier_raw.html` (via the same fresh extractor), after mechanically
proving — not assuming — that the "extra" physical `<li>` in each surah is
the trailing one (physical position 287 for Surah 2, 84 for Surah 36):
every one of that surah's declared items 1..N matches the corresponding
physical `<li>` 1..N character-for-character, with zero divergence, which
is only possible if the undeclared extra item is the one after the last
declared item. See `generate_manifest.py`'s module docstring for the full
account. **The canonical target for these two segments was never derived,
guessed, or assigned** — `canonical_targets` is `[]` for both, exactly as
the governance rules require; only their TEXT (which was always
extractable, independent of the target question) was recovered.

## 4. Nothing re-fetched from Wikisource

Per PHASE2-MAPPING-ARCHITECTURE.md §9, the importer/manifest generator
never re-fetches Wikisource; `texte_entier_raw.html` on disk (frozen since
Phase 1, `2026-09-01`, confirmed unchanged by the SHA-256 above matching
across every re-run this session) is the sole input.
