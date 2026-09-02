# Kazimirski French Translation — Human Review Package

**Status: awaiting a real, French-literate human reviewer. Nothing in this document has
been approved. No `alignment_status` has been set to `human_verified`. No `reviewed_by`
or `reviewed_at` field has been populated anywhere in this project's data.**

This package exists because an AI agent (Claude) cannot perform the literate human
review this project's governance requires before any production import can be
considered — see `PHASE2-MAPPING-ARCHITECTURE.md` §14 and every phase since. Everything
below was compiled, verified, and cross-checked by AI-agent analysis
(`alignment_status` values of `auto_verified`/`cross_verified` only) — that is real,
useful work, but it is explicitly **not** a substitute for a human confirming it.

For each item below, record your decision in the `REVIEWER DECISION` field
(`APPROVE` / `REJECT` / `NEEDS_MORE_REVIEW`) and add `REVIEWER NOTES`. Do not skip an
item. When you're done, the decisions here get transcribed into a manifest amendment
(§5 of the Phase 5 gate) — they are not applied automatically by anything in this
document.

**Reviewer:** _______________________  **Date:** _______________________

---

## TIER 1 — Corrected Surah 2 / Surah 36 reconciliation

### Background

Phase 3's initial local import found 2 physical Kazimirski source positions with no
importable text — literal empty `<li class="mw-empty-elt">` placeholders in the
Wikisource HTML, one in Surah 2, one in Surah 36 — which left canonical āyahs 2:8 and
36:35 uncovered, and left the *last* real-text segment of each surah (originally
extracted at ordinal 287 for Surah 2, 84 for Surah 36) with no canonical target.

Phase 4 investigated using the actual 1869 Charpentier scan (Wikisource djvu page
images, same provenance chain as Google Books ID `3XSe413MJyQC`) and found: the French
text was **never actually missing** at either position — Kazimirski's own printed
verse numbering runs continuously with no gap at either point. The empty `<li>` was a
**MediaWiki transcription artifact** that had been silently consuming a position slot
in the extractor, shifting every subsequent real segment's assigned ordinal by +1 for
the rest of both surahs (271 of 286 segments in Surah 2; 49 of 83 in Surah 36). The fix
excludes empty `<li>` elements from position counting; no French text was added,
removed, or altered anywhere — confirmed by the aggregate source-text hash staying
byte-identical before and after
(`12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26`).

**What you're being asked to confirm**: not whether individual translations are
"correct" in a literary sense (that's the Tier 2/3 job below), but specifically
whether this *renumbering/re-targeting* reconciliation is sound — i.e., that the
sequence below is genuinely gapless and continuous, that 2:8/36:35 are now backed by
real Kazimirski text rather than an editorial guess, and that the previously-unresolved
final segment of each surah is legitimately that surah's closing verse rather than
something misattributed.

### Surah 2 — region around the fix (ordinals 1–12 of 286)

| Ordinal | Declared # | Type | Canonical target | French text |
|---|---|---|---|---|
| 1 | 1 | one_to_many | 2:1, 2:2 | "A. L. M. Voici le livre sur lequel il n'y a point de doute ;" |
| 2 | 2 | offset | 2:3 | "De ceux qui croient aux choses cachées, qui observent exacte…" |
| 3 | 3 | offset | 2:4 | "De ceux qui croient aux révélations envoyées d'en haut à toi…" |
| 4 | 4 | offset | 2:5 | "Eux seuls seront conduits par leur Seigneur, eux seuls seron…" |
| 5 | 5 | offset | 2:6 | "Pour les infidèles, il leur est égal que tu les avertisses o…" |
| 6 | 6 | offset | 2:7 | "Dieu a apposé un sceau sur leurs cœurs et sur leurs oreilles…" |
| **7** | **7** | **offset** | **2:8** | **"Il est des hommes qui disent : Nous croyons en Dieu et au jour dernier, et cependant ils ne sont pas du nombre des croyants."** ← the previously-uncovered āyah |
| 8 | 8 | offset | 2:9 | "Ils cherchent à tromper Dieu et ceux qui croient, mais ils n…" |
| 9 | 9 | offset | 2:10 | "Une infirmité siège dans leurs cœurs, et Dieu ne fera que l'…" |
| … | … | … | … | (continuous, gapless, ordinal = declared# throughout this range) |

### Surah 2 — tail (ordinals 280–286 of 286)

| Ordinal | Declared # | Type | Canonical target | French text |
|---|---|---|---|---|
| 280 | 280 | direct | 2:280 | "Si votre débiteur éprouve de la gêne, attendez qu'il soit pl…" |
| 281 | 281 | direct | 2:281 | "Craignez le jour où vous retournerez à Dieu, où toute âme se…" |
| 282 | 282 | direct | 2:282 | "Ô vous qui croyez ! Lorsque vous contractez une dette payabl…" |
| 283 | 283 | direct | 2:283 | "Si vous êtes en voyage, et que vous ne trouviez pas d'écriva…" |
| 284 | 284 | direct | 2:284 | "Tout ce qui est dans les cieux et sur la terre appartient à …" |
| 285 | 285 | direct | 2:285 | "Le prophète croit en ce que le Seigneur lui a envoyé. Les fi…" |
| **286** | *(null — see note)* | **direct** | **2:286** | **"Dieu n'imposera à aucune âme un fardeau qui soit au-dessus de ses forces… Donne-nous la victoire sur les infidèles."** ← the previously-unresolved segment; this is Al-Baqarah's closing dua, confirmed against Pickthall 2:286 word-for-word |

**Data-quality note (minor, not a correctness issue)**: this final row's
`source_declared_number` field is `NULL` rather than `286` — it wasn't backfilled
during the Phase 4 fix since this specific segment came from the "unresolved" bucket
rather than the renumbered cascade. The `source_ordinal` (286), `alignment_type`
(direct), and canonical target (2:286) are all correct; only this one display field is
incomplete. Flag if you'd like it backfilled before sign-off.

**REVIEWER DECISION: APPROVE** (recorded 2026-09-01, reviewer amkristian91@gmail.com —
see `PHASE5-REVIEW-DECISIONS.json` for the full record)

**REVIEWER NOTES:** "I reviewed the corrected Surah 2 reconciliation. The sequence
around 2:8 is continuous, and the French text assigned to 2:8 corresponds to the
canonical ayah. The final segment corresponds to 2:286 and is consistent with the
closing verse of Al-Baqarah. Approved subject to correcting source_declared_number for
the final segment to 286 only if that number is directly confirmed in the 1869 source.
This approval applies ONLY to the Surah 2 Tier 1 review item. It does not constitute
approval of Surah 36, Tier 2, Tier 3, the full Kazimirski manifest, or production
import."

Applied to exactly 2 `translation_segments` rows (surah 2, ordinals 7 and 286) —
`alignment_status='human_verified'`. The 284 other Surah 2 segments shown only as
continuity context remain at `cross_verified` (AI-verified), unchanged, since they
were not individually re-examined by the reviewer. The conditional
`source_declared_number` backfill was **not applied** — that number has not yet been
directly confirmed in the 1869 scan (Phase 4 only viewed the scan page near the start
of Surah 2, not the page covering its final verse); the field remains `NULL` pending
that direct confirmation.

### Surah 36 — full sequence, ordinals 30–83 of 83 (region around the fix through the end; ordinals 1–29 are unaffected by this fix and omitted for brevity, available in full in `translation_segments`/local Postgres on request)

| Ordinal | Declared # | Type | Canonical target | French text |
|---|---|---|---|---|
| 30 | 30 | many_to_one | 36:31 | "Ne voient-ils pas combien de générations nous avons dét…" |
| 31 | 31 | many_to_one | 36:31 | "Ce n'est point à eux (aux faux dieux) qu'ils retournero…" |
| 32 | 32 | direct | 36:32 | "Tous, réunis, seront amenés devant nous." |
| 33 | 33 | direct | 36:33 | "Que la terre, morte de sécheresse, leur serve de signe …" |
| 34 | 34 | direct | 36:34 | "Nous y avons planté des jardins de dattiers et de vigne…" |
| **35** | **35** | **direct** | **36:35** | **"Afin qu'ils mangent de leurs fruits et jouissent des travaux de leurs mains. Ne seront-ils pas reconnaissants envers nous ?"** ← the previously-uncovered āyah |
| 36 | 36 | direct | 36:36 | "Gloire à celui qui a créé tous les couples, tant parmi …" |
| … | … | … | … | (continuous, gapless, ordinal = declared# throughout) |
| 82 | 82 | direct | 36:82 | "Quel est son arrêt ? Lorsqu'il veut qu'une chose soit f…" |
| **83** | *(null — same note as above)* | **direct** | **36:83** | **"Gloire à celui qui dans ses mains tient la souveraineté sur toutes choses. Vous retournerez tous à lui."** ← the previously-unresolved segment; Ya-Sin's closing verse, confirmed against Pickthall 36:83 |

**REVIEWER DECISION: APPROVE** (recorded 2026-09-01, reviewer amkristian91@gmail.com —
see `PHASE5-REVIEW-DECISIONS.json` for the full record)

**REVIEWER NOTES:** "I reviewed the corrected Surah 36 reconciliation. The sequence
around 36:35 is continuous, and the French text assigned to 36:35 corresponds to the
canonical ayah. The final segment corresponds to 36:83 and is consistent with the
closing verse of Ya-Sin. Approved subject to correcting source_declared_number for the
final segment to 83 only if that number is directly confirmed in the 1869 source. Do
not infer the value solely from the source ordinal or canonical target. This approval
applies ONLY to the Surah 36 Tier 1 review item. It does not constitute approval of any
Tier 2 compound case, any Tier 3 surah, the full Kazimirski manifest, or production
import."

Applied to exactly 2 `translation_segments` rows (surah 36, ordinals 35 and 83) —
`alignment_status='human_verified'`. The 81 other Surah 36 segments shown only as
continuity context remain at `cross_verified` (AI-verified), unchanged. The
conditional `source_declared_number` backfill was **not applied** — not yet directly
confirmed in the 1869 scan (Phase 4's view of scan page 358 was used for the 36:35 gap,
not the surah's final page); the field remains `NULL` pending that direct confirmation.

---

## TIER 2 — All 8 compound boundary cases

Each of these āyahs simultaneously receives content from a split segment *and* is
itself a merge target — the one-classification-per-āyah model breaks down, so the
exact partition of meaning between contributing segments needs an editorial decision.
AI-agent analysis (Phase 4) found all 8 mechanically consistent with canonical Arabic
and left every one's `mapping_confidence` at `needs_review` — none were auto-approved.

### 3:39
- Segment (ordinal 33): *"Et ici Zacharie se mit à prier Dieu. Seigneur, accorde-moi une postérité bénie ; tu aimes à exaucer les prières des suppliants. Ses anges l'appelèrent pendant qu'il priait dans le sanctuaire."*
- Segment (ordinal 34): *"Dieu t'annonce la naissance de Yahia (saint Jean), qui confirmera la vérité du Verbe de Dieu ; il sera grand, chaste, un prophète du nombre des justes."*
- Canonical Arabic (3:39): فَنَادَتْهُ ٱلْمَلَـٰٓئِكَةُ وَهُوَ قَآئِمٌ يُصَلِّى فِى ٱلْمِحْرَابِ أَنَّ ٱللَّهَ يُبَشِّرُكَ بِيَحْيَىٰ مُصَدِّقًۢا بِكَلِمَةٍ مِّنَ ٱللَّهِ وَسَيِّدًا وَحَصُورًا وَنَبِيًّا مِّنَ ٱلصَّـٰلِحِينَ

**REVIEWER DECISION: APPROVE** (recorded 2026-09-01, reviewer amkristian91@gmail.com —
see `PHASE5-REVIEW-DECISIONS.json` decision `phase5-003-tier2-compound-3-39-approve`)

**REVIEWER NOTES:** "The end of source segment ordinal 33 corresponds to the opening
portion of canonical 3:39, where the angels call Zacharie while he is praying in the
sanctuary. Source segment ordinal 34 continues with the announcement of Yahia (John),
including the elements corresponding to confirmation of the Word of God, leadership,
chastity, prophethood, and righteousness. The French content therefore legitimately
spans the modern canonical boundary, and the two contributing segments together
correspond to canonical 3:39. The compound classification is appropriate. This
approval applies ONLY to 3:39."

Applied to exactly the two `translation_segment_ayahs` join rows targeting 3:39
(`mapping_confidence: needs_review → human_verified`). Segment ordinal 33's separate
join to 3:38 (not part of this dispute) stays at `auto`, untouched.

### 3:167, 11:39, 14:44, 47:21, 65:3, 65:10, 106:4
_(Same structure as above — full segment text, canonical Arabic, and evidence for all
8 are in `scripts/quran-import/kazimirski/local-prototype/review_queue.md`, which this
package incorporates by reference rather than duplicating in full here. Pull each
entry from that file for the remaining 7.)_

- 3:167 — **DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-004-tier2-compound-3-167-approve`)
  **NOTES:** "Source segment ordinal 160 contains the portion corresponding to the
  hypocrites being called to fight or defend, their response, and the statement that
  on that day they were nearer to disbelief than to faith. Source segment ordinal 161
  continues the same canonical ayah with the statement that they say with their lips
  what is not in their hearts, followed by the statement that God knows what they
  conceal. The French content therefore legitimately crosses Kazimirski's source
  segment boundary while corresponding to canonical 3:167. Applies ONLY to 3:167."
  Applied to exactly the two join rows targeting 3:167
  (`mapping_confidence: needs_review → human_verified`); segment ordinal 160's
  separate join to 3:166 stays at `auto`, untouched.
- 11:39 — **DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-005-tier2-compound-11-39-approve`)
  **NOTES:** "Source segment ordinal 40 enters canonical 11:39 with the concluding
  phrase 'et vous apprendrez' ('and you will learn/know'), after material belonging to
  the preceding context. Source segment ordinal 41 completes that thought with the
  punishment that brings disgrace and the punishment that remains permanently,
  corresponding to the remainder of canonical 11:39. Applies ONLY to 11:39."
  Applied to exactly the two join rows targeting 11:39
  (`mapping_confidence: needs_review → human_verified`); segment ordinal 40's separate
  join to 11:38 stays at `auto`, untouched.
- 14:44 — **DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-006-tier2-compound-14-44-approve`)
  **NOTES:** "Source segment ordinal 44 enters canonical 14:44 with 'Avertis donc les
  hommes du jour des châtiments'. Source segment ordinal 45 continues with the
  wrongdoers' request for a delay. Source segment ordinal 46 completes the ayah with
  their promise to answer God's call, followed by the response concerning what they
  had previously sworn. Three segments, expected semantic order. Applies ONLY to
  14:44." Applied to exactly the three join rows targeting 14:44
  (`mapping_confidence: needs_review → human_verified`); segment ordinal 44's separate
  join to 14:43 stays at `auto`, untouched.
- 47:21 — **DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-007-tier2-compound-47-21-approve`)
  **NOTES:** "Source segment ordinal 22 enters canonical 47:21 with 'Cependant
  l'obéissance et un langage convenable leur siéraient mieux'. Source segment ordinal
  23 completes the ayah with keeping faith with God being better once the matter is
  resolved. Applies ONLY to 47:21." Applied to exactly the two join rows targeting
  47:21 (`mapping_confidence: needs_review → human_verified`); segment ordinal 22's
  separate join to 47:20 stays at `auto`, untouched.
- 65:3 — **DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-008-tier2-compound-65-3-approve`)
  **NOTES:** "Source segment ordinal 2 crosses into canonical 65:3 with God providing
  from unexpected sources for the one who fears Him. Source segment ordinal 3
  continues with God being sufficient for the one who trusts Him, bringing His decrees
  to completion, and having assigned a measure to all things. Applies ONLY to 65:3."
  Applied to exactly the two join rows targeting 65:3
  (`mapping_confidence: needs_review → human_verified`); segment ordinal 2's separate
  join to 65:2 stays at `auto`, untouched.
- 65:10 — **DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-009-tier2-compound-65-10-approve`)
  **NOTES:** "Source segment ordinal 10 covers God preparing severe punishment and the
  command to fear God. Source segment ordinal 11 begins the remaining portion
  concerning believers and God's reminder, before continuing into the following
  canonical context (segment 11 also has a separate forward join to 65:11, out of
  scope here). This approval concerns alignment/segmentation only, not editorial
  approval of Kazimirski's translation choices. Applies ONLY to 65:10." Applied to
  exactly the two join rows targeting 65:10
  (`mapping_confidence: needs_review → human_verified`); segment ordinal 11's separate
  forward join to 65:11 stays at `auto`, untouched.
- 106:4 — **DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-010-tier2-compound-106-4-approve`)
  **NOTES:** "Source segment ordinal 3 crosses into canonical 106:4 with 'le Dieu qui
  les a nourris et préservés de la famine' (fed/protected from hunger). Source segment
  ordinal 4 completes it with 'Et qui les a délivrés des alarmes' (delivered from
  fear). This approval concerns alignment/segmentation only, not editorial approval of
  Kazimirski's translation choices. Applies ONLY to 106:4." Applied to exactly the two
  join rows targeting 106:4 (`mapping_confidence: needs_review → human_verified`);
  segment ordinal 3's separate join to 106:3 (already `cross_verified` from Phase 1's
  own hand-worked example of this surah) stays unchanged.

**TIER 2 STATUS: COMPLETE — all 8/8 compound boundary cases human-reviewed and
APPROVED.**

---

## TIER 3 — Stratified concordance-only sample

15 surahs (19.7% of the ~76 surahs whose classification rests on the Flügel↔Cairo
concordance PDF rather than a direct French read against a canonical French reference):
**21, 22, 53, 58, 72, 77, 80, 87, 89, 91, 100, 102, 103, 105, 107.**

**Full segment-level evidence — real French text, real canonical Arabic (fetched from
the local DB, never hand-typed), current alignment metadata, and one blank decision
block per surah — is in the dedicated supplement:
[`PHASE5-TIER3-HUMAN-EVIDENCE.md`](./PHASE5-TIER3-HUMAN-EVIDENCE.md).** That file
also resolves the eligible-population count (76, independently reconfirmed against
the live database) and is explicit about which of the 42 segments Phase 4 originally
described could actually be reconstructed exactly (the 29 flagged split/merge
segments in the 7 non-trivial surahs) versus which could not (Phase 4's original
first/middle/last picks in the 8 purely-direct surahs — no artifact preserved which
ordinals it checked, so a new, clearly-labeled proposed sample is offered in their
place instead of a guess). AI-agent analysis found 0 discrepancies across everything
that could be checked, but none of that constitutes human review, and it does not
exempt any of the 15 surahs from your sign-off.

For each of the 15 surahs: **DECISION** (APPROVE / REJECT / NEEDS_MORE_REVIEW):
**NOTES:**

| Surah | Decision | Notes |
|---|---|---|
| 21 | ______ | ______ |
| 22 | ______ | ______ |
| 53 | ______ | ______ |
| 58 | ______ | ______ |
| 72 | ______ | ______ |
| 77 | ______ | ______ |
| 80 | ______ | ______ |
| 87 | ______ | ______ |
| 89 | ______ | ______ |
| 91 | ______ | ______ |
| 100 | ______ | ______ |
| 102 | ______ | ______ |
| 103 | ______ | ______ |
| 105 | ______ | ______ |
| 107 | ______ | ______ |

You may expand this sample to any additional surah at your discretion — the
architecture and manifest support reviewing any segment, not just these 15.

---

## If you find a systematic mismatch

Stop reviewing that category and say so explicitly rather than continuing to approve
items — per this project's governance rules, a systematic error in even a sample means
production import design stays blocked until it's understood, not just noted.
