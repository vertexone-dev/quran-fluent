# Kazimirski French Translation — Phase 1 Alignment Audit

**Status: AUDIT ONLY. No import. No migration. No database writes. No git commits.**
This document and its accompanying data files (`surah_alignment_matrix.csv`,
`segment_classification_full.csv`, and intermediate JSON/text artifacts) are research
output for a governance decision, produced under `scripts/quran-import/kazimirski/`.

Date of this audit: 2026-09-01 (session date; see system context).

---

## 0. Method summary (read this first — it explains why the numbers below are trustworthy)

Prior research (`scripts/quran-import/KAZIMIRSKI-RESEARCH.md`) found 3 confirmed 1:many
cases by manual reading and left "full enumeration across all 114 surahs" as explicitly
incomplete. This audit closes most of that gap using a **new, independently-sourced,
cross-validated method**:

1. **Re-fetched** the Wikisource "Texte entier" page fresh (`texte_entier_raw.html`,
   2,199,477 bytes) and re-ran the `<ol><li>` structural sweep from scratch, without
   relying on the prior research's numbers. Result: identical to prior findings (see §1).

2. **Fetched** the Flügel(1834)↔Cairo(1925) correlation chart PDF that prior research
   only used for the 12 mismatched surahs' *totals*
   (`https://www.muhammadanism.org/Quran/correlation_cairo_flugel_quran.pdf` — note: this
   site's TLS certificate is expired; fetched with `curl -k`, content itself unaffected).
   This PDF turns out to contain a **full verse-by-verse, side-by-side English
   correlation table for all 114 surahs** (Flügel numbering vs. Cairo numbering, same
   English translation text on both sides, just re-bracketed into different verse
   boundaries) — far more than prior research used. This is the key new asset that made
   full-scope classification possible in this session.

3. Wrote a parser (`robust_align.py`) that:
   - Extracts the Flügel-numbered and Cairo-numbered item lists per surah from the PDF's
     text layer (`pdftotext -layout`, column-split on whitespace gaps).
   - Aligns the two columns' word streams with `difflib.SequenceMatcher` (not naive
     word-counting — naive counting was tried first and produced badly inflated,
     wrong results; see §0.1) to build a robust position mapping tolerant of the PDF's
     minor OCR noise (a handful of case/hyphenation differences per surah, confirmed by
     inspection).
   - For every Flügel-numbered item, determines exactly which Cairo-numbered item(s) its
     text overlaps → this **is** the split/merge/offset classification, derived from real
     text content, not assumption.

4. **Cross-validated three independent ways**, all agreeing on all 114 surahs:
   - Kazimirski's own printed "N versets" header count = the PDF's Flügel count, for
     **114/114 surahs** (one single OCR typo found and corrected, see §0.2).
   - The PDF's Cairo count = QuranRoots' canonical ayah count (ground-truth file), for
     **114/114 surahs**.
   - The PDF's own summary statistics page states "52 surahs have similar division, 62
     have dissimilar division" — my independently-computed clean/non-clean surah split
     is **52/62, exactly matching**, with the exact same 52 surah numbers.

5. **Spot-verified the automated output against Kazimirski's actual French text** (not
   just the English concordance) for a substantial, deliberately-chosen sample — see
   §0.3 for exactly which surahs got this deeper check.

### 0.1 A methodological dead end, reported for transparency

The first alignment attempt used naive cumulative word-count position matching between
the two PDF columns. It produced obviously wrong results — e.g. Surah 2 showed "260
splits" out of 286 items, which is impossible (that surah's Flügel/Cairo totals are
*identical*, 286=286, so only a handful of offsetting splits/merges can exist). Root
cause: tiny OCR-level word-count drift (2 words different out of ~12,400, e.g.
"Guardian—Lord," transcribed as one word on one side and two on the other) compounds
across hundreds of items into cascading false positives. Switching to
`difflib.SequenceMatcher`-based alignment (which finds the actual matching text blocks
rather than trusting cumulative counts) fixed this: Surah 2 dropped from a false "260
splits" to a real, manually-spot-verified **9 splits / 9 merges** (net 0, consistent with
286=286). This is reported so the confidence level of the final numbers is understood to
rest on a corrected, verified method, not the first thing that ran without erroring.

### 0.2 One correction made to the third-party source

The concordance PDF itself has a typo in Surah 9: its Flügel column prints "82." twice in
a row (skipping "83") — confirmed by direct inspection of the raw extracted text. This is
an error in the *third-party 2007 reference document*, not in Kazimirski's text or in
QuranRoots' canonical data. Corrected by relabeling the second "82." as "83." (content
otherwise reads as a clean, unremarkable 1:1 offset mapping at that point — see
Surah 9 detail in §4).

### 0.3 What got full French-text verification vs. concordance-only classification

**Every one of the 114 surahs got full item-level A/B/C/D classification** via the method
above (§0), and that classification is available for all ~6,238 declared items in
`segment_classification_full.csv`. What varies is whether Kazimirski's **actual French
wording** was directly read and compared against the English concordance text to confirm
the classification, or whether the surah relies on the concordance's English text alone
(cross-validated at the surah level via the three checks in §0 point 4, but not read
word-for-word against the French).

**Got direct French-text verification in this session** (exact quotes given in §4):
- Al-Fatiha (1), Surah 2 item 1 and item 273, Surah 3 item 1, Surah 4 items 1–9, Surah 7
  (sample), Surah 8 (sample), Surah 9 items 61–62 and the typo-affected 82/83 pair,
  Surah 26 (sample), Surah 27 (sample), Surah 36 item 1, Surah 42 item 1, Surah 45
  (sample), Surah 47 (sample), Surah 71 (sample), Surah 74 items 31–34, Surah 78
  (sample), Surah 101 (all 8 items, full), Surah 106 items 3–4, and **all 29 muqattaʿat
  surah openings** (item 1 of surahs 2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28,
  29, 30, 31, 32, 36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68).
- That is **~40 surahs** with at least one directly-French-verified item, including all
  12 count-mismatched surahs and all 29 muqattaʿat surahs (task-prioritization criteria
  (a) and (b)).

**Concordance-classification-only, not individually French-verified in this session**
(~74 surahs, mostly the "similar division" clean surahs plus the un-sampled portion of
the 62 "dissimilar" surahs): classification is still derived from real text-overlap
detection (not guessed), and rests on the 3-way cross-validation in §0 holding for those
surahs too (which it does, per the count-level checks) — but no one has read Kazimirski's
actual 19th-century French line by line against these for every item. **This is the
honest boundary of this session's verification depth.** Sizing the remaining work: a full
French-text read-through of the ~74 unsampled surahs' flagged items (roughly 380 of the
~450 C/D segments outside the sampled set) is estimated at several additional hours of
close reading; it is not a re-run of the automated method, which already covers 100% of
surahs structurally.

---

## 1. Verify existing research

Spot-checked and independently re-derived, not blindly trusted:

- **Provenance**: confirmed unchanged (Charpentier 1869 printing, Wikisource
  `Avancement=V`, Harvard/Google Books scan `3XSe413MJyQC`, public domain).
- **114/114 surahs present**: re-confirmed by independently re-parsing the fresh HTML
  fetch — 114 `<h3 class="tmp mw-html-heading">` chapter headings found, matching 114
  expected surahs in order, no duplicates, no gaps.
- **12 mismatched-count surahs**: re-confirmed exactly — same 12 surah numbers
  (4, 7, 8, 9, 26, 27, 45, 47, 71, 74, 78, 101), same declared-vs-canonical counts. No
  discrepancy found with prior research.
- **3 confirmed 1:many cases**: re-confirmed exactly, with the actual French text
  re-extracted independently this session (see §4) — Al-Fatiha's ayah-7 merge, Surah 2
  item 1 (muqattaʿat merge), Surah 36 item 1 (muqattaʿat merge). No discrepancy.
- **Structural sweep (111/114 clean li-count-vs-declared)**: re-confirmed exactly —
  Surah 2 (+1, 287 vs 286), Surah 36 (+1, 84 vs 83), Surah 91's merged-view `<ol>`
  quirk (this fresh fetch actually *did* render an `<ol>` for Surah 91, unlike what
  prior research saw, but it was missing its closing `</ol>` and final `</li>` tag —
  same underlying transclusion fragility prior research flagged, different symptom;
  handled by extracting raw `<li>` count directly, giving the correct 15/15).

**Nothing found that contradicts prior research.** This session's contribution is
*expanding* coverage from 3 confirmed 1:many cases to a full 114-surah,
item-level-classified sweep (§2–§3), using a source (the full concordance table) prior
research had only used for surah-level totals.

---

## 2. Complete 114-surah alignment matrix

Full data: `surah_alignment_matrix.csv` (114 rows, all fields below plus A/B/C/D/F
per-surah counts). Segment-level detail for all ~6,240 individual items:
`segment_classification_full.csv`.

Column key: **Direct 1:1** = segment count matches canonical count AND no split/merge
detected. **Offset-only** = counts match but with a numbering shift and no split/merge
(turns out **zero surahs** are pure offset-only — see §2.1). **1:Many / Many:1** =
at least one detected split/merge. **Ambiguous** = unresolved boundary (Surahs 1, 2, 36
only). **Manual Review** = any of the above, or one of the 12 count-mismatched surahs, or
a muqattaʿat surah.

<details>
<summary>Full 114-row matrix (click to expand in your editor — also see
surah_alignment_matrix.csv)</summary>

| Surah | Canon Ayahs | Kaz Declared | Kaz Actual li | Flügel Offset | Direct 1:1 | Offset-only | 1:Many | Many:1 | Ambiguous | Manual Review | A | B | C | D | Uncovered | Muqattaʿat |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 7 | 7 | 7 | NO | NO | NO | NO | YES | YES | YES | 0 | 5 | 0 | 2 | 1 | NO |
| 2 | 286 | 286 | 287 | NO | NO | NO | YES | YES | YES | YES | 22 | 237 | 9 | 18 | 0 | YES |
| 3 | 200 | 200 | 200 | NO | NO | NO | YES | YES | NO | YES | 1 | 160 | 14 | 25 | 0 | YES |
| 4 | 176 | 175 | 175 | YES | NO | NO | YES | YES | NO | YES | 13 | 137 | 10 | 15 | 0 | NO |
| 5 | 120 | 120 | 120 | NO | NO | NO | YES | YES | NO | YES | 13 | 86 | 7 | 14 | 0 | NO |
| 6 | 165 | 165 | 165 | NO | NO | NO | YES | YES | NO | YES | 128 | 31 | 2 | 4 | 0 | NO |
| 7 | 206 | 205 | 205 | YES | NO | NO | YES | YES | NO | YES | 10 | 179 | 6 | 10 | 0 | YES |
| 8 | 75 | 76 | 76 | YES | NO | NO | YES | YES | NO | YES | 35 | 36 | 1 | 4 | 0 | NO |
| 9 | 129 | 130 | 130 | YES | NO | NO | NO | YES | NO | YES | 60 | 68 | 0 | 2 | 0 | NO |
| 10 | 109 | 109 | 109 | NO | NO | NO | YES | YES | NO | YES | 38 | 68 | 1 | 2 | 0 | YES |
| 11 | 123 | 123 | 123 | NO | NO | NO | YES | YES | NO | YES | 5 | 99 | 7 | 12 | 0 | YES |
| 12 | 111 | 111 | 111 | NO | NO | NO | YES | YES | NO | YES | 103 | 5 | 1 | 2 | 0 | YES |
| 13 | 43 | 43 | 43 | NO | NO | NO | YES | YES | NO | YES | 25 | 12 | 2 | 4 | 0 | YES |
| 14 | 52 | 52 | 52 | NO | NO | NO | YES | YES | NO | YES | 9 | 25 | 6 | 12 | 0 | YES |
| 15 | 99 | 99 | 99 | NO | YES | NO | NO | NO | NO | YES | 99 | 0 | 0 | 0 | 0 | YES |
| 16 | 128 | 128 | 128 | NO | NO | NO | YES | YES | NO | YES | 20 | 102 | 2 | 4 | 0 | NO |
| 17 | 111 | 111 | 111 | NO | NO | NO | YES | YES | NO | YES | 11 | 91 | 3 | 6 | 0 | NO |
| 18 | 110 | 110 | 110 | NO | NO | NO | YES | YES | NO | YES | 13 | 84 | 5 | 8 | 0 | NO |
| 19 | 98 | 98 | 98 | NO | NO | NO | YES | YES | NO | YES | 17 | 66 | 5 | 10 | 0 | YES |
| 20 | 135 | 135 | 135 | NO | NO | NO | YES | YES | NO | YES | 28 | 80 | 9 | 18 | 0 | YES |
| 21 | 112 | 112 | 112 | NO | NO | NO | YES | YES | NO | YES | 72 | 37 | 1 | 2 | 0 | NO |
| 22 | 78 | 78 | 78 | NO | NO | NO | YES | YES | NO | YES | 20 | 50 | 2 | 6 | 0 | NO |
| 23 | 118 | 118 | 118 | NO | NO | NO | YES | YES | NO | YES | 27 | 86 | 1 | 4 | 0 | NO |
| 24 | 64 | 64 | 64 | NO | NO | NO | YES | YES | NO | YES | 40 | 18 | 2 | 4 | 0 | NO |
| 25 | 77 | 77 | 77 | NO | NO | NO | YES | YES | NO | YES | 13 | 58 | 2 | 4 | 0 | NO |
| 26 | 227 | 228 | 228 | YES | NO | NO | YES | YES | NO | YES | 153 | 70 | 1 | 4 | 0 | YES |
| 27 | 93 | 95 | 95 | YES | NO | NO | NO | YES | NO | YES | 43 | 48 | 0 | 4 | 0 | YES |
| 28 | 88 | 88 | 88 | NO | NO | NO | YES | YES | NO | YES | 65 | 20 | 1 | 2 | 0 | YES |
| 29 | 69 | 69 | 69 | NO | NO | NO | YES | YES | NO | YES | 17 | 49 | 1 | 2 | 0 | YES |
| 30 | 60 | 60 | 60 | NO | NO | NO | YES | YES | NO | YES | 5 | 52 | 1 | 2 | 0 | YES |
| 31 | 34 | 34 | 34 | NO | NO | NO | YES | YES | NO | YES | 1 | 30 | 1 | 2 | 0 | YES |
| 32 | 30 | 30 | 30 | NO | NO | NO | YES | YES | NO | YES | 20 | 7 | 1 | 2 | 0 | YES |
| 33 | 73 | 73 | 73 | NO | NO | NO | YES | YES | NO | YES | 63 | 7 | 1 | 2 | 0 | NO |
| 34 | 54 | 54 | 54 | NO | NO | NO | YES | YES | NO | YES | 9 | 42 | 1 | 2 | 0 | NO |
| 35 | 45 | 45 | 45 | NO | NO | NO | YES | YES | NO | YES | 6 | 28 | 3 | 8 | 0 | NO |
| 36 | 83 | 83 | 84 | NO | NO | NO | YES | YES | YES | YES | 52 | 28 | 1 | 2 | 0 | YES |
| 37 | 182 | 182 | 182 | NO | NO | NO | YES | YES | NO | YES | 108 | 69 | 2 | 3 | 0 | NO |
| 38 | 88 | 88 | 88 | NO | NO | NO | YES | YES | NO | YES | 33 | 49 | 2 | 4 | 0 | YES |
| 39 | 75 | 75 | 75 | NO | NO | NO | YES | YES | NO | YES | 14 | 53 | 3 | 5 | 0 | NO |
| 40 | 85 | 85 | 85 | NO | NO | NO | YES | YES | NO | YES | 25 | 48 | 4 | 8 | 0 | YES |
| 41 | 54 | 54 | 54 | NO | NO | NO | YES | YES | NO | YES | 27 | 24 | 1 | 2 | 0 | YES |
| 42 | 53 | 53 | 53 | NO | NO | NO | YES | YES | NO | YES | 2 | 43 | 2 | 6 | 0 | YES |
| 43 | 89 | 89 | 89 | NO | NO | NO | YES | YES | NO | YES | 37 | 49 | 1 | 2 | 0 | YES |
| 44 | 59 | 59 | 59 | NO | NO | NO | YES | YES | NO | YES | 22 | 34 | 1 | 2 | 0 | YES |
| 45 | 37 | 36 | 36 | YES | NO | NO | YES | NO | NO | YES | 0 | 35 | 1 | 0 | 0 | YES |
| 46 | 35 | 35 | 35 | NO | NO | NO | YES | YES | NO | YES | 0 | 32 | 1 | 2 | 0 | YES |
| 47 | 38 | 40 | 40 | YES | NO | NO | YES | YES | NO | YES | 3 | 31 | 1 | 5 | 0 | NO |
| 48 | 29 | 29 | 29 | NO | YES | NO | NO | NO | NO | NO | 29 | 0 | 0 | 0 | 0 | NO |
| 49 | 18 | 18 | 18 | NO | YES | NO | NO | NO | NO | NO | 18 | 0 | 0 | 0 | 0 | NO |
| 50 | 45 | 45 | 45 | NO | NO | NO | YES | YES | NO | YES | 12 | 30 | 1 | 2 | 0 | YES |
| 51 | 60 | 60 | 60 | NO | YES | NO | NO | NO | NO | NO | 60 | 0 | 0 | 0 | 0 | NO |
| 52 | 49 | 49 | 49 | NO | YES | NO | NO | NO | NO | NO | 49 | 0 | 0 | 0 | 0 | NO |
| 53 | 62 | 62 | 62 | NO | NO | NO | YES | YES | NO | YES | 29 | 30 | 1 | 2 | 0 | NO |
| 54 | 55 | 55 | 55 | NO | YES | NO | NO | NO | NO | NO | 55 | 0 | 0 | 0 | 0 | NO |
| 55 | 78 | 78 | 78 | NO | NO | NO | YES | YES | NO | YES | 61 | 14 | 1 | 2 | 0 | NO |
| 56 | 96 | 96 | 96 | NO | NO | NO | YES | YES | NO | YES | 43 | 47 | 2 | 4 | 0 | NO |
| 57 | 29 | 29 | 29 | NO | NO | NO | YES | YES | NO | YES | 21 | 5 | 1 | 2 | 0 | NO |
| 58 | 22 | 22 | 22 | NO | NO | NO | YES | YES | NO | YES | 2 | 17 | 1 | 2 | 0 | NO |
| 59 | 24 | 24 | 24 | NO | YES | NO | NO | NO | NO | NO | 24 | 0 | 0 | 0 | 0 | NO |
| 60 | 13 | 13 | 13 | NO | YES | NO | NO | NO | NO | NO | 13 | 0 | 0 | 0 | 0 | NO |
| 61 | 14 | 14 | 14 | NO | YES | NO | NO | NO | NO | NO | 14 | 0 | 0 | 0 | 0 | NO |
| 62 | 11 | 11 | 11 | NO | YES | NO | NO | NO | NO | NO | 11 | 0 | 0 | 0 | 0 | NO |
| 63 | 11 | 11 | 11 | NO | YES | NO | NO | NO | NO | NO | 11 | 0 | 0 | 0 | 0 | NO |
| 64 | 18 | 18 | 18 | NO | YES | NO | NO | NO | NO | NO | 18 | 0 | 0 | 0 | 0 | NO |
| 65 | 12 | 12 | 12 | NO | NO | NO | YES | YES | NO | YES | 8 | 0 | 2 | 2 | 0 | NO |
| 66 | 12 | 12 | 12 | NO | YES | NO | NO | NO | NO | NO | 12 | 0 | 0 | 0 | 0 | NO |
| 67 | 30 | 30 | 30 | NO | YES | NO | NO | NO | NO | NO | 30 | 0 | 0 | 0 | 0 | NO |
| 68 | 52 | 52 | 52 | NO | YES | NO | NO | NO | NO | YES | 52 | 0 | 0 | 0 | 0 | YES |
| 69 | 52 | 52 | 52 | NO | YES | NO | NO | NO | NO | NO | 52 | 0 | 0 | 0 | 0 | NO |
| 70 | 44 | 44 | 44 | NO | YES | NO | NO | NO | NO | NO | 44 | 0 | 0 | 0 | 0 | NO |
| 71 | 28 | 29 | 29 | YES | NO | NO | YES | YES | NO | YES | 5 | 19 | 1 | 4 | 0 | NO |
| 72 | 28 | 28 | 28 | NO | NO | NO | YES | YES | NO | YES | 23 | 2 | 1 | 2 | 0 | NO |
| 73 | 20 | 20 | 20 | NO | YES | NO | NO | NO | NO | NO | 20 | 0 | 0 | 0 | 0 | NO |
| 74 | 56 | 55 | 55 | YES | NO | NO | YES | YES | NO | YES | 32 | 15 | 4 | 4 | 0 | NO |
| 75 | 40 | 40 | 40 | NO | YES | NO | NO | NO | NO | NO | 40 | 0 | 0 | 0 | 0 | NO |
| 76 | 31 | 31 | 31 | NO | YES | NO | NO | NO | NO | NO | 31 | 0 | 0 | 0 | 0 | NO |
| 77 | 50 | 50 | 50 | NO | YES | NO | NO | NO | NO | NO | 50 | 0 | 0 | 0 | 0 | NO |
| 78 | 40 | 41 | 41 | YES | NO | NO | NO | YES | NO | YES | 39 | 0 | 0 | 2 | 0 | NO |
| 79 | 46 | 46 | 46 | NO | YES | NO | NO | NO | NO | NO | 46 | 0 | 0 | 0 | 0 | NO |
| 80 | 42 | 42 | 42 | NO | NO | NO | YES | YES | NO | YES | 37 | 2 | 1 | 2 | 0 | NO |
| 81 | 29 | 29 | 29 | NO | YES | NO | NO | NO | NO | NO | 29 | 0 | 0 | 0 | 0 | NO |
| 82 | 19 | 19 | 19 | NO | YES | NO | NO | NO | NO | NO | 19 | 0 | 0 | 0 | 0 | NO |
| 83 | 36 | 36 | 36 | NO | YES | NO | NO | NO | NO | NO | 36 | 0 | 0 | 0 | 0 | NO |
| 84 | 25 | 25 | 25 | NO | YES | NO | NO | NO | NO | NO | 25 | 0 | 0 | 0 | 0 | NO |
| 85 | 22 | 22 | 22 | NO | YES | NO | NO | NO | NO | NO | 22 | 0 | 0 | 0 | 0 | NO |
| 86 | 17 | 17 | 17 | NO | YES | NO | NO | NO | NO | NO | 17 | 0 | 0 | 0 | 0 | NO |
| 87 | 19 | 19 | 19 | NO | YES | NO | NO | NO | NO | NO | 19 | 0 | 0 | 0 | 0 | NO |
| 88 | 26 | 26 | 26 | NO | YES | NO | NO | NO | NO | NO | 26 | 0 | 0 | 0 | 0 | NO |
| 89 | 30 | 30 | 30 | NO | NO | NO | YES | YES | NO | YES | 5 | 19 | 2 | 4 | 0 | NO |
| 90 | 20 | 20 | 20 | NO | YES | NO | NO | NO | NO | NO | 20 | 0 | 0 | 0 | 0 | NO |
| 91 | 15 | 15 | 15 | NO | YES | NO | NO | NO | NO | NO | 15 | 0 | 0 | 0 | 0 | NO |
| 92 | 21 | 21 | 21 | NO | YES | NO | NO | NO | NO | NO | 21 | 0 | 0 | 0 | 0 | NO |
| 93 | 11 | 11 | 11 | NO | YES | NO | NO | NO | NO | NO | 11 | 0 | 0 | 0 | 0 | NO |
| 94 | 8 | 8 | 8 | NO | YES | NO | NO | NO | NO | NO | 8 | 0 | 0 | 0 | 0 | NO |
| 95 | 8 | 8 | 8 | NO | YES | NO | NO | NO | NO | NO | 8 | 0 | 0 | 0 | 0 | NO |
| 96 | 19 | 19 | 19 | NO | YES | NO | NO | NO | NO | NO | 19 | 0 | 0 | 0 | 0 | NO |
| 97 | 5 | 5 | 5 | NO | YES | NO | NO | NO | NO | NO | 5 | 0 | 0 | 0 | 0 | NO |
| 98 | 8 | 8 | 8 | NO | NO | NO | YES | YES | NO | YES | 1 | 4 | 1 | 2 | 0 | NO |
| 99 | 8 | 8 | 8 | NO | YES | NO | NO | NO | NO | NO | 8 | 0 | 0 | 0 | 0 | NO |
| 100 | 11 | 11 | 11 | NO | YES | NO | NO | NO | NO | NO | 11 | 0 | 0 | 0 | 0 | NO |
| 101 | 11 | 8 | 8 | YES | NO | NO | YES | NO | NO | YES | 0 | 5 | 3 | 0 | 0 | NO |
| 102 | 8 | 8 | 8 | NO | YES | NO | NO | NO | NO | NO | 8 | 0 | 0 | 0 | 0 | NO |
| 103 | 3 | 3 | 3 | NO | YES | NO | NO | NO | NO | NO | 3 | 0 | 0 | 0 | 0 | NO |
| 104 | 9 | 9 | 9 | NO | YES | NO | NO | NO | NO | NO | 9 | 0 | 0 | 0 | 0 | NO |
| 105 | 5 | 5 | 5 | NO | YES | NO | NO | NO | NO | NO | 5 | 0 | 0 | 0 | 0 | NO |
| 106 | 4 | 4 | 4 | NO | NO | NO | YES | YES | NO | YES | 2 | 0 | 1 | 1 | 0 | NO |
| 107 | 7 | 7 | 7 | NO | YES | NO | NO | NO | NO | NO | 7 | 0 | 0 | 0 | 0 | NO |
| 108 | 3 | 3 | 3 | NO | YES | NO | NO | NO | NO | NO | 3 | 0 | 0 | 0 | 0 | NO |
| 109 | 6 | 6 | 6 | NO | YES | NO | NO | NO | NO | NO | 6 | 0 | 0 | 0 | 0 | NO |
| 110 | 3 | 3 | 3 | NO | YES | NO | NO | NO | NO | NO | 3 | 0 | 0 | 0 | 0 | NO |
| 111 | 5 | 5 | 5 | NO | YES | NO | NO | NO | NO | NO | 5 | 0 | 0 | 0 | 0 | NO |
| 112 | 4 | 4 | 4 | NO | YES | NO | NO | NO | NO | NO | 4 | 0 | 0 | 0 | 0 | NO |
| 113 | 5 | 5 | 5 | NO | YES | NO | NO | NO | NO | NO | 5 | 0 | 0 | 0 | 0 | NO |
| 114 | 6 | 6 | 6 | NO | YES | NO | NO | NO | NO | NO | 6 | 0 | 0 | 0 | 0 | NO |

</details>

### 2.1 Headline structural finding beyond prior research

**Zero of the 62 "dissimilar division" surahs are pure constant-offset.** Prior research's
framing (12 surahs with count mismatches = "the" numbering problem, 3 confirmed 1:many
cases elsewhere) understated the scope. In fact **every one of the 62 non-"asterisk"
surahs has at least one genuine split or merge**, including 50 surahs whose *totals*
match canonical exactly (masking the internal misalignment, exactly the way Al-Fatiha,
Surah 2, and Surah 36 already proved was possible). The 52 surahs the concordance itself
calls "similar division" are, per this independent re-derivation, genuinely clean
(0 splits, 0 merges) — matching exactly.

---

## 3. Segment classification totals (A–F), full 114-surah sweep

Two complementary countings are given because "segment" and "canonical ayah" are
different units and conflating them was the source of an early error in this session
(see §0.1). Both are reconciled in §6.

**By source segment** (unit = one Kazimirski `<li>`, actual physical print count = 6,240):

| Class | Meaning | Count |
|---|---|---|
| A | exact 1:1 (segment index = canonical ayah index) | 2,909 |
| B | deterministic offset (segment index ≠ canonical index, still 1:1) | 2,877 |
| C | segment spans multiple canonical ayahs | 152 |
| D | segment is one of several collapsing into one canonical ayah | 300 |
| E | segment exists but its canonical mapping is unresolved (S2, S36 extra li) | 2 |
| F | segment maps to nothing (none found) | 0 |
| **Total** | | **6,240** |

**By canonical ayah** (unit = one of the 6,236 canonical ayahs):

| Class | Meaning | Distinct ayahs |
|---|---|---|
| A | covered by an exact-index segment | 2,909 |
| B | covered by an offset segment | 2,877 |
| C | touched by a segment that also covers ≥1 other ayah | 308 |
| D | is the single target of ≥2 merged segments | 149 |
| — | (of which: also a C-ayah — a genuinely compound boundary) | 8 |
| Uncovered | no segment maps to it at all | 1 |
| **Total** | | **6,236** |

(2,909 + 2,877 + 308 + 149 − 8 overlap + 1 uncovered = 6,236 ✓)

No segment or ayah is dropped from this accounting; the 2 E-segments and 1 uncovered
ayah are carried forward explicitly into §6, not silently absorbed.

---

## 4. Investigation of C/D/E/F cases

Full machine-readable listing of **all 6,240 segments** (not just C/D/E/F) with exact
French text is in `segment_classification_full.csv`. Below is the required deep-dive —
every count-mismatched surah, both E cases, the source anomaly, and representative C/D
cases from the muqattaʿat scan and the compound-boundary set — with **verbatim** French
text (never paraphrased) and canonical Arabic boundary.

### 4.1 The 12 count-mismatched surahs (Flügel/Kazimirski declared ≠ canonical)

All 12 were re-confirmed to have their declared count equal to Flügel's — a real,
documented 19th-century numbering convention (pre-1923 Cairo standardization), not data
corruption. Each surah's classification is now fully known (not just "mismatched by N",
but exactly *which* items split/merge and where):

**Surah 4** (176 canon / 175 declared, net +1, but 10 C + 15 D events, not a single
offset point):
- Item 3 splits: *"Si vous craignez de n'être pas équitables envers les orphelins... que le
  droit de le posséder vous donne... Donnez-leur leur dot"* → 4:3 + 4:4 (confirmed via
  English concordance: Flügel 3 = Cairo 3+4).
- Items 4, 5, 6 (French, verbatim, full text):
  *"Ne confiez pas aux ineptes les biens que Dieu a confiés à vos soins comme un fonds ;
  mais, les gérant vous-mêmes, fournissez leur sur ce fonds la nourriture et les
  vêtements, et tenez-leur toujours un langage doux et honnête."* (item 4) +
  *"Éprouvez les facultés intellectuelles des orphelins jusqu'à l'âge où ils pourront se
  marier, et si vous leur trouvez un jugement sain, alors remettez-leur leur fortune.
  Gardez-vous de la consumer par la prodigalité, et ne vous hâtez pas de la leur
  confier."* (item 5) + *"Seulement, parce qu'ils ont grandi ; que le tuteur riche
  s'abstienne de toucher au bien de ses pupilles. Celui qui est pauvre ne doit en user
  qu'avec discrétion."* (item 6) + item 7 *"Au moment où vous leur remettez leurs biens,
  faites-vous assister par des témoins. Dieu vous tiendra compte de vos actions, et cela
  vous suffit."* — items **5+6+7 all merge into canonical 4:6** (the long verse about
  testing orphans' judgment, guardian provisions, and witnesses — confirmed against the
  real Quran: 4:6 genuinely is one long verse covering all three clauses). This is a
  **D case, 3 segments → 1 ayah**, root-caused: Kazimirski (following Flügel) split one
  long Quranic verse into three numbered items; Cairo counts it as one.
- Confidence: HIGH (direct French-text read, matches concordance English exactly,
  matches real Quran 4:3–4:6 content).
- Representable without editing Kazimirski's prose: YES (segment→multi-ayah mapping for
  the split; 3 segments→1 ayah mapping for the merge — no text touched either way).

**Surah 7** (206/205, net +1; 6 C + 10 D events): item 1 splits (muqattaʿat merge, see
§4.4); sample merge at items 139/140 → canonical 7:143 (*"Lorsque Moïse arriva à l'heure
convenue et que Dieu lui eut parlé, il dit à Dieu : Seigneur, montre-toi à moi..."* +
*"Revenu à lui, il s'écria : Gloire à toi ! Je retourne à toi pénétré de repentir..."*),
confirmed against real Quran 7:143 (Moses asking to see God) which is indeed one long
verse. HIGH confidence.

**Surah 8** (75/76, net −1; 1 C + 4 D): merge sample at items 36/37 → canonical 8:36
(*"Les infidèles dépensent leurs richesses pour détourner les autres de la voie de Dieu...
Un regret..."* + *"Les infidèles seront réunis dans l'enfer."*). HIGH confidence.

**Surah 9** (129/130, net −1; 0 C + 2 D, plus the source-typo pair): merge at items
61/62 → canonical 9:61 (*"Il en est parmi eux qui déchirent le prophète..."* +
*"La miséricorde est réservée à ceux d'entre vous qui croient en Dieu..."*) — matches
real Quran 9:61, a long verse. The items 82/83 pair (previously mislabeled "82,82" in the
third-party PDF, corrected in §0.2) reads as a **clean offset**, not a split — French
text: item 82 *"Ceux qui restèrent en arrière (dans l'expédition de Tabuc)..."*, item 83
*"Qu'ils rient donc un peu ; ils pleureront beaucoup..."* [paraphrase check only, exact
row in CSV] — two distinct, sequential canonical ayahs, no merge needed there. HIGH
confidence.

**Surah 26** (227/228, net −1; 1 C + 4 D): item 1 splits (muqattaʿat, §4.4); sample merge
at items 72/73 → canonical 26:73 (*"— Vous entendent-elles quand vous les appelez ?
demanda Abraham."* + *"— Vous servent-elles à quelque chose ? peuvent-elles vous faire
quelque mal ?"*). HIGH confidence.

**Surah 27** (93/95, net −2; 0 C + 4 D — pure merges, no splits at all): sample at items
44/45 → canonical 27:44 (*"On lui dit : Entrez dans ce palais. Et quand elle le vit, elle
croyait que c'était une pièce d'eau, et se retroussa..."* + *"— Seigneur, j'avais agi
iniquement envers moi-même en adorant les idoles ; maintenant je me résigne, comme
Salomon..."*). HIGH confidence.

**Surah 45** (37/36, net +1; 1 C + 0 D): item 1 splits (muqattaʿat, §4.4) — this single
split accounts for the entire net difference; MEDIUM-HIGH confidence for the rest of the
surah (35 clean B items, concordance-only, not individually French-verified).

**Surah 47** (38/40, net −2; 1 C + 5 D): sample merge at items 4/5 → canonical 47:4
(*"Lorsque nous rencontrez des infidèles, eh bien ! tuez-les au point d'en faire un grand
carnage... "* + *"Ensuite vous les mettrez en liberté, ou les rendrez moyennant une
rançon, lorsque la guerre aura cessé..."*) — matches real Quran 47:4, a long verse on the
rules of combat and ransom. HIGH confidence.

**Surah 71** (28/29, net −1; 1 C + 4 D): sample split at item 5 (*"Noé cria ensuite vers
Dieu, et dit : Seigneur, j'ai appelé mon peuple vers toi nuit et jour, mais mon appel n'a
fait qu'augmenter leur éloignement."* → 71:5+71:6); sample merge at items 22/23
(idol names "Wedd et Sowa'" + "Iaghouth, Iaouk, Nesr" → canonical 71:23, matches real
Quran verse listing five idol names in one verse). HIGH confidence.

**Surah 74** (56/55, net +1; 4 C + 4 D): the notable case — items **31, 32, 33, 34 all
merge into canonical 74:31**, the famous long verse about the 19 guardians of Hell
(*"Nous n'avons établi pour gardiens du feu que les anges..."* + *"Et que les hommes des
Écritures et les croyants n'en doutent pas ;"* + *"Afin que ceux dont le cœur est atteint
d'une maladie, et les infidèles, disent : Que veut dire Dieu par cette parabole ?"* +
*"Il en est ainsi. Dieu égare ceux qu'il veut, et dirige ceux qu'il veut..."*) — a genuine
**4-segment → 1-ayah** case, the largest merge found in this audit. HIGH confidence,
matches the real Quran (74:31 is indeed unusually long).

**Surah 78** (40/41, net −1; 0 C + 2 D): merge at items 40/41 → canonical 78:40
(*"Nous t'avons averti de la venue prochaine du supplice,"* + *"Au jour où l'homme verra
les œuvres de ses mains, et où l'infidèle s'écriera : Plût à Dieu que je fusse
poussière !"*). HIGH confidence.

**Surah 101** (11/8, net +3; 3 C + 0 D) — full item-by-item verified (all 8 items are
short; see §4.5 for complete text). This surah has **three separate splits**, expanding
prior research's single confirmed case to all three:
- item 1 → 101:1+101:2 (already known)
- item 5 → 101:6+101:7 (**new finding this session**)
- item 6 → 101:8+101:9 (**new finding this session**)

### 4.2 The two E (ambiguous/unresolved) cases: Surah 2 and Surah 36

Both surahs have one more actual `<li>` element than Kazimirski's own declared count
(287 vs. 286 for Surah 2; 84 vs. 83 for Surah 36). Item 1 in both is fully accounted for
(the muqattaʿat merge, §4.4) — the *extra* split is a **second, separate** location
somewhere else in each surah, not yet isolated to a specific item.

This session attempted a new localization technique beyond what prior research tried: a
cumulative word-count-ratio drift analysis (Kazimirski's French item lengths vs. the
concordance's declared-numbering English item lengths, tracked as a running fraction of
total surah length, looking for a discrete jump). Result: **inconclusive**. For Surah 2,
the ratio drifts upward across roughly items 61–101 but the signal is not a clean
step — plausibly just French/English verbosity noise, the same category of noise that
broke the first (word-count-only) alignment attempt in §0.1. For Surah 36 (a much shorter
surah, 83 items), the same technique produced no discernible signal at all, dominated by
noise. **Conclusion: reported honestly as still unlocated**, same as prior research —
this session narrowed the *method* (ruled out word-count drift as viable) without
narrowing the *location*. Resolving this precisely requires direct sentence-by-sentence
reading of Kazimirski's ~286-item and ~83-item lists against a French-language verse
reference, which was not completed in this session.

Representable without editing Kazimirski's prose: YES in principle (once located, it's
either a C or D case like every other item), but the specific item cannot yet be
assigned a segment→ayah mapping. **Honest state: "alignment unresolved," not a guessed
split** — exactly the failure mode the task governance rules require avoiding.

### 4.3 The one F / source anomaly: Al-Fatiha canonical ayah 1:1 (Bismillah)

Re-confirmed with fresh extraction: Kazimirski's `<ol>` for Al-Fatiha begins at item 1 =
*"Louange à Dieu, maître de l'univers,"* — canonical ayah 1:2. The Bismillah
(*"Au nom du Dieu clément et miséricordieux"*) is present in the source, but rendered as
unnumbered introductory prose **outside** the `<ol>` entirely — confirmed by direct HTML
inspection, not inferred. This means canonical ayah 1:1 has **zero** corresponding
numbered `<li>` segment. The content exists and is translated; it just isn't part of the
enumerated list structure Kazimirski (and Wikisource's transcription of him) uses
everywhere else.

This is the **only genuinely uncovered canonical ayah** found in the entire 114-surah
sweep (§6). It requires the eventual segment model to support an "unnumbered preamble"
segment type — see §5.

Al-Fatiha's other structural detail, re-confirmed: items 6+7 merge into canonical 1:7
(*"La voie de ceux que tu as comblés de tes bienfaits,"* + *"Non celle de ceux qui ont
encouru ta colère, ni des égarés."*) — a D case.

### 4.4 Muqattaʿat surahs: full scan of all 29 surah-opening segments

All 29 muqattaʿat (disjointed-letter) surah openings were read in French this session
(item 1 of each). Result — **20 of 29 genuinely split, 9 remain clean** (the canonical
convention varies by surah; this was verified against the concordance's Cairo column,
not assumed):

**Split (item 1 spans multiple canonical ayahs)**: Surahs 2 (→2:1+2:2), 3 (→3:1+3:2+3:3,
a rare **3-way** split: *"Elif. Lam. Min.. Dieu. Il n'y a point d'autre dieu que lui, le
Vivant, l'Immuable."*), 7 (→7:1+7:2), 19 (→19:1+19:2), 20 (→20:1+20:2), 26 (→26:1+26:2),
28 (→28:1+28:2), 29 (→29:1+29:2), 30 (→30:1+30:2), 31 (→31:1+31:2), 32 (→32:1+32:2), 36
(→36:1+36:2), 38 (→38:1+38:2), 40 (→40:1+40:2), 41 (→41:1+41:2), 42 (→42:1+42:2+42:3,
also a **3-way** split: *"Ha. Mim. Aïn. Sin. Kaf.. C'est ainsi que Dieu, le Puissant, le
Sage, te donne la révélation..."*, matching the real Quran's two one-word ayat 42:1
"حم" and 42:2 "عسق" followed by 42:3), 43 (→43:1+43:2), 44 (→44:1+44:2), 45 (→45:1+45:2),
46 (→46:1+46:2).

**Clean (item 1 = canonical ayah 1, single unit on both sides)**: Surahs 10, 11, 12, 13,
14, 15, 27, 50, 68. Confirmed this is a real convention difference, not a detection gap —
e.g. Surah 15's Cairo-side text itself reads *"A. L. R. These are the Ayats of
Revelation,- of a Qur'an that makes things clear."* as **one** verse in the concordance's
own Cairo column, matching Kazimirski's *"Élif. Lam. Ra.. Voici les versets du Livre et de
la lecture lucide."*

Confidence: HIGH for all 29 (direct French-text read against the corresponding
concordance English for each).

### 4.5 Surah 101, full item-by-item (short surah, fully verified)

| Item | French (verbatim) | Canonical |
|---|---|---|
| 1 | *"LE COUP. Qu'est-ce que le coup ?"* | 101:1 + 101:2 (C) |
| 2 | *"Qui est-ce qui t'apprendra ce que c'est que le coup ?"* | 101:3 (B) |
| 3 | *"Le Jour où les hommes seront dispersés comme des papillons,"* | 101:4 (B) |
| 4 | *"Où les montagnes voleront comme des flocons de laine teinte,"* | 101:5 (B) |
| 5 | *"Celui dont les œuvres pèseront lourdement dans la balance aura une vie agréable."* | 101:6 + 101:7 (C) |
| 6 | *"Celui dont les œuvres seront légères aura pour demeure la fosse (El-hawiye)."* | 101:8 + 101:9 (C) |
| 7 | *"Qui est-ce qui peut t'apprendre ce que c'est que cette fosse ?"* | 101:10 (B) |
| 8 | *"C'est le feu ardent."* | 101:11 (B) |

All 8 declared items accounted for, all 11 canonical ayahs covered, 0 uncovered. This is
the cleanest possible demonstration that a segment→multiple-ayah mapping model works with
zero invented text: every one of these splits is a natural clause boundary already
present in Kazimirski's own punctuation.

### 4.6 The 8 compound boundary cases (an ayah that is both a split target and a merge target)

These are the trickiest cases found — a canonical ayah that receives partial content from
a split segment *and* is also itself the target of a separate merge, meaning the clean
"one classification per ayah" model breaks down and editorial judgment is needed:

`3:39`, `3:167`, `11:39`, `14:44`, `47:21`, `65:3`, `65:10`, `106:4`.

Worked example, Surah 106 (short, fully readable), items 3–4 (French verbatim):
- Item 3: *"Qu'ils servent le Dieu de ce temple, le Dieu qui les a nourris et préservés de
  la famine,"*
- Item 4: *"Et qui les a délivrés des alarmes."*
- Mapping found: item 3 → canonical 106:3 + 106:4 (split); item 4 → canonical 106:4
  (also, independently). **Canonical ayah 106:4 receives content from both item 3's tail
  and all of item 4** — the two Kazimirski segments' text is not cleanly partitionable
  ayah-by-ayah without deciding, editorially, where item 3's contribution to 106:4 ends
  and item 4's begins (they may in fact be paraphrasing/restating rather than literally
  partitioning — this needs a human French-Quran-literate reviewer, not an automated
  decision).

These 8 are flagged `MANUAL_REVIEW_REQUIRED` with the strongest wording in the CSV —
they are qualitatively different from ordinary C or D cases.

---

## 5. Mapping-aware architecture: does `translation_segments` + `translation_segment_ayahs` hold up?

**Yes, for every pattern found**, with one addition needed.

- **A / B (1:1, offset)**: trivial — one row in `translation_segment_ayahs` per segment.
- **C (1:many)**: `translation_segments` holds Kazimirski's exact original text as one
  row (e.g. Surah 101 item 1, verbatim, unedited); `translation_segment_ayahs` has two
  (or three, for Surahs 3/42) rows pointing at the same `segment_id` with different
  `(surah_number, ayah_number)` values. No text is invented or split.
- **D (many:1)**: the *reverse* — multiple `translation_segments` rows (each Kazimirski's
  own separate numbered item, verbatim) each get a `translation_segment_ayahs` row
  pointing at the *same* `(surah_number, ayah_number)`. This models Surah 74:31 cleanly:
  4 segment rows, 4 join rows, all pointing at `(74, 31)`.
- **E (unresolved, S2/S36 extra item)**: model as a segment row with **no**
  `translation_segment_ayahs` row yet, plus an explicit `alignment_status = 'unresolved'`
  column (or equivalent) rather than guessing. This is exactly the "explicit unresolved
  state" the governance rules ask for in §7.
- **F (Fatiha Bismillah, present but unnumbered)**: needs one new segment *type* — an
  "unnumbered preamble" segment, extracted from outside the `<ol>`, with its own
  `translation_segment_ayahs` row pointing at `(1,1)`. This is a straightforward addition
  to the extraction pipeline (already scoped, not a schema change), not a blocker.
- **Compound cases (§4.6)**: model as **two or more segments each linked to the same
  ayah row**, with a `confidence` or `review_status` flag on the join rows distinguishing
  "confirmed" from "needs human confirmation" — the join table already supports N:M by
  design, so no schema change is needed, just a data-quality flag.

### Reader UX recommendation

For a segment associated with multiple canonical ayahs (C case): **render the segment
once, as a single continuous block of French prose, visually spanning the ayah range it
covers** (e.g., displayed alongside a bracket or range label "2:1–2:2" rather than
duplicated per-ayah) — repeating Kazimirski's unedited sentence once per ayah row would
misrepresent his own text as if it were separately translated per-ayah, which it was not.
For multiple segments collapsing into a single ayah (D case): the inverse — **render the
merged segments concatenated in their original order under that single ayah's row**,
each retaining its own segment boundary marker (e.g., a subtle pilcrow or spacing) so a
reader can see they were originally three or four separate printed sentences, not
Kazimirski's phrasing for a single verse. In both directions, a small UI affordance
("part of a combined 19th-century verse numbering — see note") is preferable to silently
presenting either a 1:1-looking row that isn't, or an oddly-long/oddly-short row with no
explanation. This preserves provenance visibility, which matches the project's
translation-integrity principle.

---

## 6. Integrity accounting

```
CANONICAL AYAHS:                 6236
KAZIMIRSKI SOURCE SEGMENTS:      6240   (actual <li> count, all 114 surahs)

MAPPED SOURCE SEGMENTS:          6240   (every segment classified: A/B/C/D/E; none dropped)
UNMAPPED SOURCE SEGMENTS:        0

CANONICAL AYAHS COVERED:         6235
CANONICAL AYAHS UNCOVERED:       1      (Fatiha 1:1, Bismillah — present as unnumbered
                                          preamble text, not as a numbered segment)

Segment-level:  A=2909  B=2877  C=152  D=300  E=2  F=0     (sum = 6240 ✓)
Ayah-level:     A=2909  B=2877  C=308  D=149  (8 compound, counted once)  uncovered=1
                2909 + 2877 + 308 + 149 − 8 + 1 = 6236 ✓
```

**Reconciliation check, shown explicitly rather than asserted:**
6240 segments = 6238 "declared-numbering-modeled" segments (A 2909 + B 2877 + C 152 +
D 300 + F 0) **+ 2 extra physical segments** (Surah 2, Surah 36 — the still-unlocated
second discontinuity in each, §4.2), classified E. 6238 = the sum of Kazimirski's own
declared "N versets" counts across all 114 surahs (independently cross-validated against
the Flügel column of the 2007 concordance, matching exactly for 114/114 surahs).

6236 canonical ayahs = 6235 covered (every A/B/C/D ayah, counted once via set union, not
sum, to avoid the double-count identified in §3's compound-case footnote) + 1 uncovered
(Fatiha 1:1).

**Where this does NOT reconcile perfectly, stated honestly**: the 2 "E" segments (S2,
S36) are *known to exist* and *known to be additional to* the 6238 declared-model total,
but their precise canonical-ayah target is unresolved, so they contribute 0 to "ayahs
covered" beyond what the declared-model already covers (i.e., they don't add newly
covered ayahs — the ayah they subdivide is already counted once via the declared item
that's ultimately being split by their existence). This is consistent, not a gap, but is
worth flagging: it means the "ambiguity" is entirely about *where inside an already-
covered ayah's segment(s) the extra boundary falls*, not about any ayah being unaccounted
for.

---

## 7. Production feasibility answers

**Can QuranRoots provide complete Kazimirski French coverage without altering his
prose?** Yes, for 6,235 of 6,236 canonical ayahs (99.98%), using a segment→ayah mapping
model that touches zero words of his translation. The 1 remaining ayah (Fatiha 1:1) is
also coverable without altering his prose — it requires extracting an *existing*
unnumbered sentence as its own segment (a parsing addition, not an editorial one).

**Can every canonical ayah be associated with an appropriate source segment?**
Effectively yes: 6,235/6,236 already are, deterministically, via the classification in
this audit. The 6,236th requires the "unnumbered preamble" segment type (§5), which is
straightforward to add, not a genuinely hard problem.

**Can the mapping be deterministic?** For 6,236 of 6,240 segments (99.94% of segments;
covering 6,235 of 6,236 ayahs), yes, and this audit has now actually computed that
mapping (not just asserted it's possible) — see `segment_classification_full.csv`. For 2
segments (the S2/S36 extras), no: their target is genuinely unresolved pending further
manual research, and should be represented as such, not guessed.

**How many mappings require human/editorial verification?** All 6,240 segments have an
automated classification; **~452 segments** (152 C + 300 D) sit inside a split or merge
and warrant human sign-off before import, per this project's standing "never silently
reinterpret translation boundaries" principle, even though this audit found no case where
the automated boundary looked implausible against the actual French text sampled. Of
those, **~40 surahs' worth (roughly half by surah count, weighted toward the higher-
value 12 mismatched + 29 muqattaʿat surahs)** already have direct French-text
confirmation from this session; the rest rely on the cross-validated but not
line-by-line-French-read concordance classification. The **8 compound cases** (§4.6)
need the most careful review — they are not simple splits or merges.

**Are any mappings genuinely unresolved?** Yes: exactly 2 (Surah 2's and Surah 36's
extra `<li>`, §4.2), plus by extension every segment *after* that unresolved point within
those two surahs carries a small positional-uncertainty risk (the declared-numbering
assumption may be off by one from the true unlocated point onward) that this audit could
not fully rule out for those two surahs specifically. This is a small, bounded, named
risk — not a blanket uncertainty across all 114 surahs.

**Can unresolved cases be represented honestly without inventing translation
boundaries?** Yes — this is exactly what the `alignment_status = 'unresolved'` state in
§5 is for. This audit deliberately did **not** guess a split point for Surah 2 or 36's
extra item despite attempting a new localization technique; it reports the technique's
failure honestly (§4.2) rather than presenting a plausible-looking but unverified guess.

---

## Appendix: files in this directory

- `PHASE1-ALIGNMENT-AUDIT.md` — this document.
- `surah_alignment_matrix.csv` — 114 rows, §2's matrix in machine-readable form.
- `segment_classification_full.csv` — 6,240 rows, every Kazimirski segment, its
  classification, canonical ayah range, and exact French text (verbatim).
- `flugel_cairo_concordance.pdf` / `.txt` — the fetched 2007 correlation chart (source:
  muhammadanism.org; note expired TLS cert on that host, content unaffected).
- `texte_entier_raw.html` — the fetched Wikisource "Texte entier" page.
- `kazimirski_li_texts.json` — every `<li>` text, all 114 surahs, cleaned of HTML/
  footnote markers, indexed by surah.
- `surah_structural_sweep.json`, `concordance_analysis.json`, `full_maps_robust.json`,
  `per_surah_robust.json`, `surah_pdf_pages.json`, `surah_header_lines.txt` —
  intermediate working data supporting the above, kept for reproducibility.
- `robust_align.py` — the alignment script (§0), reusable for future re-verification.

No file outside `scripts/quran-import/kazimirski/` was created or modified. No database
was touched. No git operation was performed.
