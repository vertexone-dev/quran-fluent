# Kazimirski French Translation — Tier 3 Human-Review Evidence

**Status: EVIDENCE ONLY. No Tier 3 item has been approved. No row's alignment_status
or mapping_confidence has been set to `human_verified` as part of building this
document. Nothing in this file has been applied to the database.**

This supplement exists so a French-literate human reviewer can inspect the Tier 3
sample directly — real French text, real canonical Arabic (fetched from the local
canonical `ayahs` table, never hand-typed), and real current alignment metadata —
without relying on any AI statement that a mapping "passed."

---

## 1. Tier 3 eligible population

**Concordance-only pool size: 76** (surahs where every segment's
`alignment_status` is still `auto_verified` — i.e. no segment in that surah has
been individually French-verified by any human or AI-agent primary-source check).
Independently recomputed directly against the current local database for this
document and confirmed to match `review_queue.json`'s recorded
`concordance_only_pool_size: 76` exactly.

**Why earlier documentation said "~74"**: Phase 1's audit narrative (§0.3/§7) used
"~74 surahs" as a rough prose estimate before any precise pool was ever computed.
Phase 3, when actually building the stratified sampling queue, computed the exact
pool for real (76) from the live data. No error or mapping change explains the
difference — it is an approximate narrative figure from early in the project versus
a precise count computed once precision actually mattered for sampling. No mapping
was altered to reconcile this; the two numbers simply come from different levels of
rigor at different points in the project.

**Sample size: 15 surahs (19.74% of the 76-surah pool)** —
21, 22, 53, 58, 72, 77, 80, 87, 89, 91, 100, 102, 103, 105, 107.

---

## 2–3. Sample integrity and reconstruction status

Phase 4's own final report described its Tier 3 method as "18 at every split/merge
boundary in the 7 non-trivial surahs; 24 first/middle/last spot checks in the 8
pure-direct surahs" (42 total). Reconstructing this exactly against the actual saved
artifacts found:

- **The 7 non-trivial surahs' split/merge segments ARE fully reconstructable**,
  because `review_queue.json`'s `flagged_segments` arrays (generated in Phase 3,
  independent of Phase 4's own session) already enumerate them precisely, and every
  one of the 29 segments below was independently re-verified against the live
  database just now, including a target-by-target cross-check against the exact
  ordinal→canonical-ayah list this gate specified. **All matched exactly, zero
  discrepancies.** This is a genuine reconstruction, not an approximation — though
  note the actual count is **29 segments**, not exactly "18" — Phase 4's own summary
  number appears to have been an approximate description rather than a precise count;
  the real, complete flagged-segment set for these 7 surahs is what's shown below.

- **The 8 pure-direct surahs' original "first/middle/last" segments are NOT
  reconstructable.** No artifact anywhere in this project (`review_queue.json`,
  the manifest, or any Phase 4 output file) records which specific `source_ordinal`
  values Phase 4 actually spot-checked for these surahs — only Phase 4's own
  end-of-session prose summary describes the *method* ("first/middle/last"), not the
  *ordinals*. **Per this gate's explicit instruction, this reconstruction is reported
  as impossible rather than guessed or silently faked.**

  **Proposed deterministic replacement** (clearly a new sample, not Phase 4's
  original one): for each of the 8 surahs, the actual first, middle, and last
  `source_ordinal` among that surah's numbered segments, computed just now directly
  from the live database (`Math.floor((n-1)/2)` for the middle index, deduplicated
  where a surah has fewer than 3 segments). This is offered for the reviewer's use
  in place of the lost original sample — it is not a claim about what Phase 4 saw.

### Per-surah sample accounting

| Surah | Eligible segments | Sampled | Sampling basis | Flagged split/merge included | Reconstruction status |
|---|---|---|---|---|---|
| 21 | (full surah) | 3 | every split/merge (C/D) boundary segment | YES, all 3 | **Exact reconstruction** (from `review_queue.json`, independently re-verified) |
| 22 | (full surah) | 8 | every split/merge (C/D) boundary segment | YES, all 8 | **Exact reconstruction** (from `review_queue.json`, independently re-verified) |
| 53 | (full surah) | 3 | every split/merge (C/D) boundary segment | YES, all 3 | **Exact reconstruction** (from `review_queue.json`, independently re-verified) |
| 58 | (full surah) | 3 | every split/merge (C/D) boundary segment | YES, all 3 | **Exact reconstruction** (from `review_queue.json`, independently re-verified) |
| 72 | (full surah) | 3 | every split/merge (C/D) boundary segment | YES, all 3 | **Exact reconstruction** (from `review_queue.json`, independently re-verified) |
| 80 | (full surah) | 3 | every split/merge (C/D) boundary segment | YES, all 3 | **Exact reconstruction** (from `review_queue.json`, independently re-verified) |
| 89 | (full surah) | 6 | every split/merge (C/D) boundary segment | YES, all 6 | **Exact reconstruction** (from `review_queue.json`, independently re-verified) |
| 77 | 50 | 3 | proposed first/middle/last (ordinals 1, 25, 50) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |
| 87 | 19 | 3 | proposed first/middle/last (ordinals 1, 10, 19) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |
| 91 | 15 | 3 | proposed first/middle/last (ordinals 1, 8, 15) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |
| 100 | 11 | 3 | proposed first/middle/last (ordinals 1, 6, 11) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |
| 102 | 8 | 3 | proposed first/middle/last (ordinals 1, 4, 8) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |
| 103 | 3 | 3 | proposed first/middle/last (ordinals 1, 2, 3) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |
| 105 | 5 | 3 | proposed first/middle/last (ordinals 1, 3, 5) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |
| 107 | 7 | 3 | proposed first/middle/last (ordinals 1, 4, 7) | none exist in this surah | **NOT reconstructable — proposed replacement shown, not Phase 4's original sample** |

---

## 4. Human review units

Fifteen independent decision blocks. Each is currently **PENDING HUMAN REVIEW** —
none pre-filled.

- **T3-S21: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-011-tier3-t3-s21-approve`)
- **T3-S22: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-012-tier3-t3-s22-approve`)
- **T3-S53: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-013-tier3-t3-s53-approve`)
- **T3-S58: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-014-tier3-t3-s58-approve`)
- **T3-S72: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-015-tier3-t3-s72-approve`)
- **T3-S77: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-016-tier3-t3-s77-approve` —
  deterministic replacement sample, not reconstructed original Phase 4 evidence)
- **T3-S80: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-024-tier3-t3-s80-approve` —
  original flagged split/merge evidence)
- **T3-S87: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-017-tier3-t3-s87-approve` — deterministic
  replacement sample, not reconstructed original Phase 4 evidence)
- **T3-S89: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-025-tier3-t3-s89-approve` —
  original flagged split/merge evidence — FINAL Tier 3 decision, 15/15 complete)
- **T3-S91: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-018-tier3-t3-s91-approve` — deterministic
  replacement sample, not reconstructed original Phase 4 evidence)
- **T3-S100: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-019-tier3-t3-s100-approve` — deterministic
  replacement sample, not reconstructed original Phase 4 evidence)
- **T3-S102: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-020-tier3-t3-s102-approve` — deterministic
  replacement sample, not reconstructed original Phase 4 evidence)
- **T3-S103: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-021-tier3-t3-s103-approve` — deterministic
  replacement sample, not reconstructed original Phase 4 evidence)
- **T3-S105: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-022-tier3-t3-s105-approve` — deterministic
  replacement sample, not reconstructed original Phase 4 evidence)
- **T3-S107: APPROVED** (2026-09-01, amkristian91@gmail.com — see
  `PHASE5-REVIEW-DECISIONS.json` decision `phase5-023-tier3-t3-s107-approve` — deterministic
  replacement sample, not reconstructed original Phase 4 evidence)

---

## 5. Full segment evidence, per surah

### T3-S21 — flagged split/merge segments (exact reconstruction)

**Ordinal 28** (declared #: 28, id `7b9f5554-c3f0-4dca-a6fa-79f519abf378`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Il sait tout ce qui est devant eux et derrière eux ; ils ne peuvent intercéder,"
- text_sha256: `4eca9d1ee8d395f38de8fa17fc6d1657bf5e6d6adfd02ca85423af7f4b345a65`
- Canonical target(s): 21:28
- Per-join mapping_confidence: 21:28=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **21:28**: يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يَشْفَعُونَ إِلَّا لِمَنِ ٱرْتَضَىٰ وَهُم مِّنْ خَشْيَتِهِۦ مُشْفِقُونَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 29** (declared #: 29, id `56c95992-5ab7-4ebe-a8a4-cedefa9364ac`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Excepté pour celui pour lequel il lui plaît, et ils tremblent de frayeur devant lui."
- text_sha256: `1944d0aeb54af6e482392c006f6ca9c2f1c9cb0ccbdc953a828503aea55434df`
- Canonical target(s): 21:28
- Per-join mapping_confidence: 21:28=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **21:28**: يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلَا يَشْفَعُونَ إِلَّا لِمَنِ ٱرْتَضَىٰ وَهُم مِّنْ خَشْيَتِهِۦ مُشْفِقُونَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 67** (declared #: 67, id `8aae97a5-0224-485d-bc9b-208d5c0620d9`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "Adorerez-vous, à côté de Dieu, ce qui ne peut ni vous être utile à rien, ni vous nuire ? Honte sur vous et sur ce que vous adorez à côté de Dieu ! Ne le comprendrez-vous pas ?"
- text_sha256: `9b5c10843574e70787bc73c7560bb07e4b763ca339f124c3e811962453324ce6`
- Canonical target(s): 21:66, 21:67
- Per-join mapping_confidence: 21:66=auto, 21:67=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **21:66**: قَالَ أَفَتَعْبُدُونَ مِن دُونِ ٱللَّهِ مَا لَا يَنفَعُكُمْ شَيْـًٔا وَلَا يَضُرُّكُمْ
  - **21:67**: أُفٍّ لَّكُمْ وَلِمَا تَعْبُدُونَ مِن دُونِ ٱللَّهِ ۖ أَفَلَا تَعْقِلُونَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S21 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com)

**NOTES:** "CASE A (21:28): source ordinals 28 and 29 together correspond coherently
and sequentially to canonical 21:28 — ordinal 28 covers God knowing what is before and
behind them and that they cannot intercede; ordinal 29 continues with the exception
for whom permission is granted and their fear before Him. The many_to_one alignment is
appropriate. CASE B (21:66-21:67): source ordinal 67 legitimately spans both canonical
āyahs — its opening corresponds to 21:66, its continuation to 21:67. The one_to_many
alignment is appropriate. No mechanical alignment defect found. Applies ONLY to
T3-S21." Applied to all 3 segments' `alignment_status` and all 4 join rows'
`mapping_confidence` (`auto_verified`/`auto` → `human_verified`) — every join for
these 3 segments belonged to this review, with no out-of-scope sibling joins to
preserve.

---

### T3-S22 — flagged split/merge segments (exact reconstruction)

**Ordinal 18** (declared #: 18, id `40755f92-1116-4614-b21a-6ce7e59b2075`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Ne vois-tu pas que tout ce qui est dans les cieux et sur fa terre adore le Seigneur, le soleil, la lune, les étoiles, les montagnes, les arbres, les animaux et une grande partie des hommes ? Le supplice est déjà résolu pour une grande partie."
- text_sha256: `84322331cb5714800a8333d11a7634907160d16107155330b0dd30efdf6b6cbc`
- Canonical target(s): 22:18
- Per-join mapping_confidence: 22:18=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **22:18**: أَلَمْ تَرَ أَنَّ ٱللَّهَ يَسْجُدُ لَهُۥ مَن فِى ٱلسَّمَـٰوَٰتِ وَمَن فِى ٱلْأَرْضِ وَٱلشَّمْسُ وَٱلْقَمَرُ وَٱلنُّجُومُ وَٱلْجِبَالُ وَٱلشَّجَرُ وَٱلدَّوَآبُّ وَكَثِيرٌ مِّنَ ٱلنَّاسِ ۖ وَكَثِيرٌ حَقَّ عَلَيْهِ ٱلْعَذَابُ ۗ وَمَن يُهِنِ ٱللَّهُ فَمَا لَهُۥ مِن مُّكْرِمٍ ۚ إِنَّ ٱللَّهَ يَفْعَلُ مَا يَشَآءُ ۩
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 19** (declared #: 19, id `aa5ad7da-9c20-410c-ac03-3000785c2381`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Et celui que Dieu rendra méprisable, qui l’honorera ? Dieu fait ce qu’il lui plaît."
- text_sha256: `5b0079c257ca708317fd54a5a5ba2f92417743f69599c08803dfe5b7dcc4620f`
- Canonical target(s): 22:18
- Per-join mapping_confidence: 22:18=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **22:18**: أَلَمْ تَرَ أَنَّ ٱللَّهَ يَسْجُدُ لَهُۥ مَن فِى ٱلسَّمَـٰوَٰتِ وَمَن فِى ٱلْأَرْضِ وَٱلشَّمْسُ وَٱلْقَمَرُ وَٱلنُّجُومُ وَٱلْجِبَالُ وَٱلشَّجَرُ وَٱلدَّوَآبُّ وَكَثِيرٌ مِّنَ ٱلنَّاسِ ۖ وَكَثِيرٌ حَقَّ عَلَيْهِ ٱلْعَذَابُ ۗ وَمَن يُهِنِ ٱللَّهُ فَمَا لَهُۥ مِن مُّكْرِمٍ ۚ إِنَّ ٱللَّهَ يَفْعَلُ مَا يَشَآءُ ۩
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 21** (declared #: 21, id `989e5e1e-9d9f-4f2f-a269-3a409e6a7006`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "Leurs entrailles et leur peau en seront consumées ; ils seront frappés de gourdins de fer."
- text_sha256: `6aa56821dc495aaf6b116408238a8a9a1344e48ebf67f6be23a7aa785e9abdc3`
- Canonical target(s): 22:20, 22:21
- Per-join mapping_confidence: 22:20=auto, 22:21=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **22:20**: يُصْهَرُ بِهِۦ مَا فِى بُطُونِهِمْ وَٱلْجُلُودُ
  - **22:21**: وَلَهُم مَّقَـٰمِعُ مِنْ حَدِيدٍ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 25** (declared #: 25, id `8f7fe413-14a0-4907-8032-c9f3236d3d8a`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Les infidèles sont ceux qui éloignent les autres du chemin de Dieu et de l’oratoire sacré que nous avons établi pour tous les hommes ; ceux qui y résident comme les externes ont un droit égal à le visiter."
- text_sha256: `98a48b71aa2e2342b348cb0ce9eef754afc2199f704b32193e0518f4ace88510`
- Canonical target(s): 22:25
- Per-join mapping_confidence: 22:25=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **22:25**: إِنَّ ٱلَّذِينَ كَفَرُوا۟ وَيَصُدُّونَ عَن سَبِيلِ ٱللَّهِ وَٱلْمَسْجِدِ ٱلْحَرَامِ ٱلَّذِى جَعَلْنَـٰهُ لِلنَّاسِ سَوَآءً ٱلْعَـٰكِفُ فِيهِ وَٱلْبَادِ ۚ وَمَن يُرِدْ فِيهِ بِإِلْحَادٍۭ بِظُلْمٍ نُّذِقْهُ مِنْ عَذَابٍ أَلِيمٍ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 26** (declared #: 26, id `554e62df-2982-4998-82a8-58def93531ef`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Et ceux qui voudraient le profaner par méchanceté éprouveront un châtiment douloureux."
- text_sha256: `7d0967dac0242caa36930947dae7c44487062fec0649d01827bfc5767219b401`
- Canonical target(s): 22:25
- Per-join mapping_confidence: 22:25=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **22:25**: إِنَّ ٱلَّذِينَ كَفَرُوا۟ وَيَصُدُّونَ عَن سَبِيلِ ٱللَّهِ وَٱلْمَسْجِدِ ٱلْحَرَامِ ٱلَّذِى جَعَلْنَـٰهُ لِلنَّاسِ سَوَآءً ٱلْعَـٰكِفُ فِيهِ وَٱلْبَادِ ۚ وَمَن يُرِدْ فِيهِ بِإِلْحَادٍۭ بِظُلْمٍ نُّذِقْهُ مِنْ عَذَابٍ أَلِيمٍ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 43** (declared #: 43, id `690018d5-f50a-4cf9-81c5-8956c4deaaed`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "S’ils t’accusent d’imposture, ô Mohammed ! songe donc qu’avant eux les peuples de Noé, d’Ad, de Thémoud, d’Abraham, de Loth, les Madianites, en accusaient leurs prophètes. Moïse aussi a été traité de menteur. J’ai accordé un long délai aux incrédules, puis je les ai atteints de mon châtiment. Qu’il a été terrible !"
- text_sha256: `b45dc6683709753589c4258139865170102f21b0728fe629aa9e0639ee0dd70d`
- Canonical target(s): 22:42, 22:43, 22:44
- Per-join mapping_confidence: 22:42=auto, 22:43=auto, 22:44=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **22:42**: وَإِن يُكَذِّبُوكَ فَقَدْ كَذَّبَتْ قَبْلَهُمْ قَوْمُ نُوحٍ وَعَادٌ وَثَمُودُ
  - **22:43**: وَقَوْمُ إِبْرَٰهِيمَ وَقَوْمُ لُوطٍ
  - **22:44**: وَأَصْحَـٰبُ مَدْيَنَ ۖ وَكُذِّبَ مُوسَىٰ فَأَمْلَيْتُ لِلْكَـٰفِرِينَ ثُمَّ أَخَذْتُهُمْ ۖ فَكَيْفَ كَانَ نَكِيرِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 77** (declared #: 77, id `730eab81-25bd-4545-b0af-e80b50b490ec`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Combattez pour la cause de Dieu comme il convient de le faire ; il vous a élus. Il ne vous a rien commandé de difficile dans votre religion, dans la religion de votre père Abraham ; il vous a nommés musulmans (qui s’abandonnent à Dieu)."
- text_sha256: `7d64df42428e53df1e2594996d0801b0f7951f37345dd204fb0e992435a288d5`
- Canonical target(s): 22:78
- Per-join mapping_confidence: 22:78=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **22:78**: وَجَـٰهِدُوا۟ فِى ٱللَّهِ حَقَّ جِهَادِهِۦ ۚ هُوَ ٱجْتَبَىٰكُمْ وَمَا جَعَلَ عَلَيْكُمْ فِى ٱلدِّينِ مِنْ حَرَجٍ ۚ مِّلَّةَ أَبِيكُمْ إِبْرَٰهِيمَ ۚ هُوَ سَمَّىٰكُمُ ٱلْمُسْلِمِينَ مِن قَبْلُ وَفِى هَـٰذَا لِيَكُونَ ٱلرَّسُولُ شَهِيدًا عَلَيْكُمْ وَتَكُونُوا۟ شُهَدَآءَ عَلَى ٱلنَّاسِ ۚ فَأَقِيمُوا۟ ٱلصَّلَوٰةَ وَءَاتُوا۟ ٱلزَّكَوٰةَ وَٱعْتَصِمُوا۟ بِٱللَّهِ هُوَ مَوْلَىٰكُمْ ۖ فَنِعْمَ ٱلْمَوْلَىٰ وَنِعْمَ ٱلنَّصِيرُ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 78** (declared #: 78, id `40a63e8e-624d-4376-a6bf-6c6ac262c56d`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Il vous a nommés ainsi bien avant nous et dans ce livre aussi, afin que votre prophète soit témoin contre vous et que vous soyez témoins contre le reste des hommes. Observez donc la prière, faites l’aumône, attachez-vous fermement à Dieu, il est votre patron ; et quel patron et quel protecteur !"
- text_sha256: `e646077cbc57e2c7796a1d78065c3238f18498edd4ef784808bfb9c98f7ade6e`
- Canonical target(s): 22:78
- Per-join mapping_confidence: 22:78=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **22:78**: وَجَـٰهِدُوا۟ فِى ٱللَّهِ حَقَّ جِهَادِهِۦ ۚ هُوَ ٱجْتَبَىٰكُمْ وَمَا جَعَلَ عَلَيْكُمْ فِى ٱلدِّينِ مِنْ حَرَجٍ ۚ مِّلَّةَ أَبِيكُمْ إِبْرَٰهِيمَ ۚ هُوَ سَمَّىٰكُمُ ٱلْمُسْلِمِينَ مِن قَبْلُ وَفِى هَـٰذَا لِيَكُونَ ٱلرَّسُولُ شَهِيدًا عَلَيْكُمْ وَتَكُونُوا۟ شُهَدَآءَ عَلَى ٱلنَّاسِ ۚ فَأَقِيمُوا۟ ٱلصَّلَوٰةَ وَءَاتُوا۟ ٱلزَّكَوٰةَ وَٱعْتَصِمُوا۟ بِٱللَّهِ هُوَ مَوْلَىٰكُمْ ۖ فَنِعْمَ ٱلْمَوْلَىٰ وَنِعْمَ ٱلنَّصِيرُ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S22 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com)

**NOTES:** "CASE A (22:18): ordinals 18+19 cover worship of the heavens/earth material
then the humiliation/God-does-what-He-wills close. CASE B (22:20-21): ordinal 21
spans both — insides/skins consumed (22:20), iron clubs (22:21). CASE C (22:25):
ordinals 25+26 cover hindering from the Sacred Mosque then profanation/punishment.
CASE D (22:42-44): ordinal 43 preserves the canonical progression Noah/Ad/Thamud,
Abraham/Lot, Midian/Moses/punishment — all three targets substantively represented.
CASE E (22:78): ordinals 77+78 cover striving/election/no hardship/Abraham's
religion/naming as Muslims, then witness/prayer/almsgiving/holding to God. No
mechanical alignment defect found. Concerns alignment only, not
alteration/modernization of Kazimirski's wording. Applies ONLY to T3-S22." Applied to
all 8 segments' `alignment_status` and all 11 join rows' `mapping_confidence`
(`auto_verified`/`auto` → `human_verified`) — every join for these 8 segments
belonged to this review, freshly re-confirmed with no out-of-scope sibling joins
before writing anything.

---

### T3-S53 — flagged split/merge segments (exact reconstruction)

**Ordinal 26** (declared #: 26, id `dd97ad3b-9280-4629-91a4-6a1e72cefeec`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Que d’anges dans les deux dont l’intercession ne servira de rien,"
- text_sha256: `2a40df5fcb056c29ab4281bb911740559b21ef0a5bbcfdc5d7fbcef2070c1297`
- Canonical target(s): 53:26
- Per-join mapping_confidence: 53:26=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **53:26**: وَكَم مِّن مَّلَكٍ فِى ٱلسَّمَـٰوَٰتِ لَا تُغْنِى شَفَـٰعَتُهُمْ شَيْـًٔا إِلَّا مِنۢ بَعْدِ أَن يَأْذَنَ ٱللَّهُ لِمَن يَشَآءُ وَيَرْضَىٰٓ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 27** (declared #: 27, id `0ae3d0f8-e2c5-47d0-9097-a39dbc5e8338`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Sauf, si Dieu permet d’intercéder, à celui qu’il voudra, à celui qu’il lui plaira."
- text_sha256: `bf3342f1ff18aa8ed3e316fa999cb5adf1a22e556012e1c9d7c5b951e39da5c3`
- Canonical target(s): 53:26
- Per-join mapping_confidence: 53:26=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **53:26**: وَكَم مِّن مَّلَكٍ فِى ٱلسَّمَـٰوَٰتِ لَا تُغْنِى شَفَـٰعَتُهُمْ شَيْـًٔا إِلَّا مِنۢ بَعْدِ أَن يَأْذَنَ ٱللَّهُ لِمَن يَشَآءُ وَيَرْضَىٰٓ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 58** (declared #: 58, id `92476db5-8853-4b28-abcd-3fa2a22e5987`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "L’heure qui doit venir approche, et point de remède contre elle, excepté en Dieu."
- text_sha256: `d672da04b647dec526f27bb7ce94dbe90d8e64d34778ff09709bc731772c9045`
- Canonical target(s): 53:57, 53:58
- Per-join mapping_confidence: 53:57=auto, 53:58=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **53:57**: أَزِفَتِ ٱلْـَٔازِفَةُ
  - **53:58**: لَيْسَ لَهَا مِن دُونِ ٱللَّهِ كَاشِفَةٌ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S53 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com)

**NOTES:** "CASE A (53:26): ordinals 26+27 — opening material on angels' intercession
being of no avail, then the exception clause 'Sauf...' continuing with God's
permission and choosing/approval; boundary corresponds naturally to the Arabic
exception structure beginning with illā. CASE B (53:57-58): ordinal 58 — 'L'heure qui
doit venir approche' corresponds to 53:57; 'et point de remède contre elle, excepté en
Dieu' corresponds to 53:58. No mechanical alignment defect found. Historical/archaic
French wording is not itself a defect; not modernized or corrected. Applies ONLY to
T3-S53." Applied to all 3 segments' `alignment_status` and all 4 join rows'
`mapping_confidence` (`auto_verified`/`auto` → `human_verified`) — freshly re-confirmed
no out-of-scope sibling joins before writing anything.

---

### T3-S58 — flagged split/merge segments (exact reconstruction)

**Ordinal 2** (declared #: 2, id `82524666-ccfd-4b68-b348-ca6a9da51cd0`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Ceux d’entre vous qui répudient leurs femmes en disant qu’ils les regarderont comme leurs mères (elles ne sont pas leurs mères ; leurs mères sont celles qui les ont enfantés), profèrent une parole blâmable et une fausseté."
- text_sha256: `57eac784e7e359b622741d4db1c13a55aacc1dff7830cb00cea94b433d987d78`
- Canonical target(s): 58:2
- Per-join mapping_confidence: 58:2=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **58:2**: ٱلَّذِينَ يُظَـٰهِرُونَ مِنكُم مِّن نِّسَآئِهِم مَّا هُنَّ أُمَّهَـٰتِهِمْ ۖ إِنْ أُمَّهَـٰتُهُمْ إِلَّا ٱلَّـٰٓـِٔى وَلَدْنَهُمْ ۚ وَإِنَّهُمْ لَيَقُولُونَ مُنكَرًا مِّنَ ٱلْقَوْلِ وَزُورًا ۚ وَإِنَّ ٱللَّهَ لَعَفُوٌّ غَفُورٌ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 3** (declared #: 3, id `20b704c8-9ef0-4a3b-afc9-813e25e83e2f`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Certes, Dieu est porté au pardon et à l’indulgence,"
- text_sha256: `44b561807d02c1594c01d150a451d9afcdcace7f59f77696cbfbfa25f18b951a`
- Canonical target(s): 58:2
- Per-join mapping_confidence: 58:2=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **58:2**: ٱلَّذِينَ يُظَـٰهِرُونَ مِنكُم مِّن نِّسَآئِهِم مَّا هُنَّ أُمَّهَـٰتِهِمْ ۖ إِنْ أُمَّهَـٰتُهُمْ إِلَّا ٱلَّـٰٓـِٔى وَلَدْنَهُمْ ۚ وَإِنَّهُمْ لَيَقُولُونَ مُنكَرًا مِّنَ ٱلْقَوْلِ وَزُورًا ۚ وَإِنَّ ٱللَّهَ لَعَفُوٌّ غَفُورٌ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 21** (declared #: 21, id `bdab7613-5375-4696-a2e4-96ce37704d3b`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "Ceux qui luttent contre Dieu et le prophète seront livrés au mépris. Dieu a écrit d’avance cet arrêt : J’aurai le dessus et mes envoyés aussi. Dieu est fort et puissant."
- text_sha256: `592954e7d7a60f8921a4f2d070dcce26c6afac8167caf9d8428e5c624206ec32`
- Canonical target(s): 58:20, 58:21
- Per-join mapping_confidence: 58:20=auto, 58:21=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **58:20**: إِنَّ ٱلَّذِينَ يُحَآدُّونَ ٱللَّهَ وَرَسُولَهُۥٓ أُو۟لَـٰٓئِكَ فِى ٱلْأَذَلِّينَ
  - **58:21**: كَتَبَ ٱللَّهُ لَأَغْلِبَنَّ أَنَا۠ وَرُسُلِىٓ ۚ إِنَّ ٱللَّهَ قَوِىٌّ عَزِيزٌ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S58 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com)

**NOTES:** "CASE A (58:2): ordinal 2 covers the zihar declaration, clarification the
wives are not their mothers, and blameworthy-speech/falsehood characterization
(through wa-zūran); ordinal 3 completes the ayah with the forgiveness/indulgence
statement. Kazimirski's sentence boundary does not constitute a canonical ayah
boundary. CASE B (58:20-21): ordinal 21 — 'Ceux qui luttent contre Dieu et le
prophète...' corresponds to 58:20; 'Dieu a écrit d'avance cet arrêt...' corresponds
to 58:21, substantively representing the decree/victory/closing attributes. No
mechanical alignment defect found. Historical French wording preserved, not
modernized. Applies ONLY to T3-S58." Applied to all 3 segments' `alignment_status`
and all 4 join rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`)
— freshly re-confirmed exact scope (2→58:2 only, 3→58:2 only, 21→58:20+58:21 only, no
out-of-scope siblings, not previously recorded) before writing anything.

---

### T3-S72 — flagged split/merge segments (exact reconstruction)

**Ordinal 22** (declared #: 22, id `40220ff5-9883-4880-92be-afd70cfc173a`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Dis-leur : Personne ne saurait me protéger contre Dieu."
- text_sha256: `f0405a63de651a9eef2c011e54aa10d79cadc531336d8e9bf94e036be4cea6ed`
- Canonical target(s): 72:22
- Per-join mapping_confidence: 72:22=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **72:22**: قُلْ إِنِّى لَن يُجِيرَنِى مِنَ ٱللَّهِ أَحَدٌ وَلَنْ أَجِدَ مِن دُونِهِۦ مُلْتَحَدًا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 23** (declared #: 23, id `cccc44cb-21a8-4e2b-bb6b-ab14aecd1c09`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "En dehors de Dieu je ne trouverai point de refuge."
- text_sha256: `655df0f9ecda703fdd0928905b41a2dd4528f8d4c36220ebbadf2a8bbd164d13`
- Canonical target(s): 72:22
- Per-join mapping_confidence: 72:22=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **72:22**: قُلْ إِنِّى لَن يُجِيرَنِى مِنَ ٱللَّهِ أَحَدٌ وَلَنْ أَجِدَ مِن دُونِهِۦ مُلْتَحَدًا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 26** (declared #: 26, id `7628a5b7-08cb-4811-87d6-693476f52755`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "Dis-leur : J’ignore si les peines dont vous êtes menacés sont proches, ou bien si Dieu leur a assigné un terme éloigné. Dieu seul connait les choses cachées et il ne les dévoile à personne,"
- text_sha256: `240b1f84aace7754029d4cdd70a746db5122d172b59715f90cdee35e2a5c63c7`
- Canonical target(s): 72:25, 72:26
- Per-join mapping_confidence: 72:25=auto, 72:26=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **72:25**: قُلْ إِنْ أَدْرِىٓ أَقَرِيبٌ مَّا تُوعَدُونَ أَمْ يَجْعَلُ لَهُۥ رَبِّىٓ أَمَدًا
  - **72:26**: عَـٰلِمُ ٱلْغَيْبِ فَلَا يُظْهِرُ عَلَىٰ غَيْبِهِۦٓ أَحَدًا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S72 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com)

**NOTES:** "CASE A (72:22): ordinal 22 'Personne ne saurait me protéger contre Dieu'
corresponds to the opening; ordinal 23 'En dehors de Dieu je ne trouverai point de
refuge' corresponds to the continuation. Kazimirski renders one canonical ayah as two
French sentences, both within 72:22's semantic boundaries. CASE B (72:25-26): ordinal
26's first sentence corresponds to 72:25; 'Dieu seul connait les choses cachées et il
ne les dévoile à personne' substantively corresponds to 72:26 — explicitly
represented, not merely inferred from context. No mechanical alignment defect found.
Historical wording not corrected or modernized. Applies ONLY to T3-S72." Applied to
all 3 segments' `alignment_status` and all 4 join rows' `mapping_confidence`
(`auto_verified`/`auto` → `human_verified`) — freshly re-confirmed exact scope before
writing anything.

---

### T3-S80 — flagged split/merge segments (exact reconstruction)

**Ordinal 15** (declared #: 15, id `9d54d3e9-3d4c-4cea-96f6-60e2cd5733d2`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "Tracé par les mains des écrivains honorés et justes."
- text_sha256: `a3e86505caf97c8cbd479210c9dfd478c07bb88e587496c38fb57113828e685c`
- Canonical target(s): 80:15, 80:16
- Per-join mapping_confidence: 80:15=auto, 80:16=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **80:15**: بِأَيْدِى سَفَرَةٍ
  - **80:16**: كِرَامٍۭ بَرَرَةٍ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 18** (declared #: 18, id `5d5f62fb-d4af-423d-aa15-78ac7ce06010`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "D’une goutte de sperme."
- text_sha256: `616de7f77cb4d349992beaa2088cad39a4cb7a5bf75340e3c68953766ce6417b`
- Canonical target(s): 80:19
- Per-join mapping_confidence: 80:19=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **80:19**: مِن نُّطْفَةٍ خَلَقَهُۥ فَقَدَّرَهُۥ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 19** (declared #: 19, id `a0860b8c-defb-4db2-9e3a-9fea1a97142b`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Il l’a créé et l’a façonné d’après certaines proportions."
- text_sha256: `182f00061b7ff1a66c6730c3c71b5b95cd5831036cee9f68ae8e830321542748`
- Canonical target(s): 80:19
- Per-join mapping_confidence: 80:19=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **80:19**: مِن نُّطْفَةٍ خَلَقَهُۥ فَقَدَّرَهُۥ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S80 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com)

**NOTES:** "Ordinal 15 (one_to_many→80:15+80:16): one continuous descriptive clause
matching the Arabic noun+adjective structure. Ordinals 18+19 (many_to_one→80:19):
fragment-then-completion is the expected shape of a many-to-one merge, together
forming one complete sentence. No mechanical alignment defect found. Applies ONLY to
T3-S80." Applied to all 3 segments' `alignment_status` and all 4 join rows'
`mapping_confidence` (`auto_verified`/`auto` → `human_verified`).

---

### T3-S89 — flagged split/merge segments (exact reconstruction)

**Ordinal 1** (declared #: 1, id `ab0fccb4-68d5-4563-922b-6bd48261fc7a`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "J’en jure par LE POINT DU JOUR et les dix nuits,"
- text_sha256: `9c31b69ebb422265b90b87d11afa0053cbba17f1c912dda96468103d64538132`
- Canonical target(s): 89:1, 89:2
- Per-join mapping_confidence: 89:1=auto, 89:2=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **89:1**: وَٱلْفَجْرِ
  - **89:2**: وَلَيَالٍ عَشْرٍ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 14** (declared #: 14, id `5b315119-3820-41fd-8c54-f87b09a984d8`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Quand, pour éprouver l’homme, Dieu le comble de bienfaits,"
- text_sha256: `2ec7b2a1cea172bbc1ed0f1589adecdd7373cb60cd5492199be6bc3fdd111a99`
- Canonical target(s): 89:15
- Per-join mapping_confidence: 89:15=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **89:15**: فَأَمَّا ٱلْإِنسَـٰنُ إِذَا مَا ٱبْتَلَىٰهُ رَبُّهُۥ فَأَكْرَمَهُۥ وَنَعَّمَهُۥ فَيَقُولُ رَبِّىٓ أَكْرَمَنِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 15** (declared #: 15, id `54f7d03b-69d0-4d7d-870f-33b932ac1b8e`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "L’homme dit : Le Seigneur m’a témoigné des égards."
- text_sha256: `3c7986ce22179fbc4f9de26a233322f4a9c1f059bedf8d939af77138185d52a1`
- Canonical target(s): 89:15
- Per-join mapping_confidence: 89:15=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **89:15**: فَأَمَّا ٱلْإِنسَـٰنُ إِذَا مَا ٱبْتَلَىٰهُ رَبُّهُۥ فَأَكْرَمَهُۥ وَنَعَّمَهُۥ فَيَقُولُ رَبِّىٓ أَكْرَمَنِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 16** (declared #: 16, id `b0fc84f5-cec6-48ac-9117-b21c8dbdc283`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "Mais que Dieu, pour l’éprouver, lui mesure ses dons,"
- text_sha256: `7957743ca2018071fd7de63fe33ca5bcebc93461c5894d9ed037d7b547bc044f`
- Canonical target(s): 89:16
- Per-join mapping_confidence: 89:16=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **89:16**: وَأَمَّآ إِذَا مَا ٱبْتَلَىٰهُ فَقَدَرَ عَلَيْهِ رِزْقَهُۥ فَيَقُولُ رَبِّىٓ أَهَـٰنَنِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 17** (declared #: 17, id `f795e111-0380-4757-8a6b-4127c92aac73`)
- Alignment type: `many_to_one` · Segment status: `auto_verified`
- French text (verbatim): "L’homme s’écrie : Le Seigneur m’a fait un affront !"
- text_sha256: `568bff0399c26f80b4c0d9e38aa3f78d8747cec95ecc63d4af53a94bbdf50600`
- Canonical target(s): 89:16
- Per-join mapping_confidence: 89:16=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **89:16**: وَأَمَّآ إِذَا مَا ٱبْتَلَىٰهُ فَقَدَرَ عَلَيْهِ رِزْقَهُۥ فَيَقُولُ رَبِّىٓ أَهَـٰنَنِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 25** (declared #: 25, id `b7862189-3280-44fc-9b0f-b75f6864c0bb`)
- Alignment type: `one_to_many` · Segment status: `auto_verified`
- French text (verbatim): "Il s’écrira : Plût à Dieu que j’eusse fait le bien durant ma vie ! Ce jour-là, nul ne saurait punir comme Dieu."
- text_sha256: `143ed38cff151b1b77ae7cc462805fe7beab0c6d757fe4ff96a3ed1c5c9f14dd`
- Canonical target(s): 89:24, 89:25
- Per-join mapping_confidence: 89:24=auto, 89:25=auto
- Also maps to another canonical āyah: YES (see targets)
- Canonical Arabic:
  - **89:24**: يَقُولُ يَـٰلَيْتَنِى قَدَّمْتُ لِحَيَاتِى
  - **89:25**: فَيَوْمَئِذٍ لَّا يُعَذِّبُ عَذَابَهُۥٓ أَحَدٌ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S89 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com — FINAL
Tier 3 decision, 15/15 complete)

**NOTES:** "A. Ordinal 1 (89:1+89:2): mirrors the Arabic's two-part oath exactly. B.
Ordinals 14+15 (89:15) and C. 16+17 (89:16): both follow the same
conditional-plus-quotation pattern as the real Arabic idhā...fa structure. D. Ordinal
25 (89:24+89:25): divides at the same point the Arabic divides into two āyahs. No
mechanical alignment defect found in any of the four structures. Applies ONLY to
T3-S89." Applied to all 6 segments' `alignment_status` and all 8 join rows'
`mapping_confidence` (`auto_verified`/`auto` → `human_verified`).

**TIER 3 STATUS: COMPLETE — 15/15 surahs human-reviewed and APPROVED.**

---

### T3-S77 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 50. Proposed ordinals: 1, 25, 50.

**Ordinal 1** (declared #: 1, id `05f2f13f-b299-4eac-a867-3a1753bbc853`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "J’en jure par ceux qui sont ENVOYÉS l’un après l’autre,"
- text_sha256: `fe7cb24b734f8a25f9cde4e15d61809104e3564d9bf451a469b2cf38e0e94272`
- Canonical target(s): 77:1
- Per-join mapping_confidence: 77:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **77:1**: وَٱلْمُرْسَلَـٰتِ عُرْفًا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 25** (declared #: 25, id `35a4c1e7-18af-4314-a2c9-3ca3838465dd`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "N’avons-nous pas constitué la terre pour renfermer"
- text_sha256: `a53631e2555404baff05da1d0f764460c75646fb3a340a478aec8bb471f48069`
- Canonical target(s): 77:25
- Per-join mapping_confidence: 77:25=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **77:25**: أَلَمْ نَجْعَلِ ٱلْأَرْضَ كِفَاتًا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 50** (declared #: 50, id `54041fa1-4446-4252-b30b-f52543ff5a18`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "En quel autre livre croiront-ils ensuite ?"
- text_sha256: `520e7cf6563d4576c5329a7f993a30909f03b78d34499e1b44abda172685896a`
- Canonical target(s): 77:50
- Per-join mapping_confidence: 77:50=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **77:50**: فَبِأَىِّ حَدِيثٍۭ بَعْدَهُۥ يُؤْمِنُونَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S77 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com)

**NOTES:** "Deterministic replacement sample, not reconstructed original Phase 4
evidence. replacement_first (ordinal 1→77:1): 'J'en jure par ceux qui sont ENVOYÉS
l'un après l'autre' corresponds substantively to wa-al-mursalāti 'urfan.
replacement_middle (ordinal 25→77:25): a targeted boundary check confirmed
neighboring ordinal 26 ('Les vivants et les morts ?', not part of this sample, left
unchanged) maps exclusively to 77:26; read consecutively, ordinals 25+26 form one
coherent sentence spanning the canonical boundary. replacement_last (ordinal
50→77:50): 'En quel autre livre croiront-ils ensuite ?' — rendering ḥadīth as 'livre'
is a translation-choice difference, not a boundary defect. No systematic ordinal
drift (0/25/50 all offset-zero). No mechanical alignment defect found. Applies ONLY
to T3-S77." Applied to exactly the 3 frozen segments' `alignment_status` and their 3
join rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`); ordinal
26 explicitly left untouched, confirmed unchanged as a postcondition.

---

### T3-S87 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 19. Proposed ordinals: 1, 10, 19.

**Ordinal 1** (declared #: 1, id `cb79ff48-6e4d-480e-a6fb-a4aa6c01bf6b`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Célèbre le nom de ton Seigneur le TRÈS-HAUT"
- text_sha256: `229663b7e343594b69661fb22424b783616306a1a29da38138dc611876bfa749`
- Canonical target(s): 87:1
- Per-join mapping_confidence: 87:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **87:1**: سَبِّحِ ٱسْمَ رَبِّكَ ٱلْأَعْلَى
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 10** (declared #: 10, id `eccaaa9d-e945-40b5-8074-c9f3fb0889bc`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Quiconque craint Dieu y réfléchira."
- text_sha256: `366ec0c6887c2b774761f4673caed21a1a56212a241d7c49be25556ef5537e0f`
- Canonical target(s): 87:10
- Per-join mapping_confidence: 87:10=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **87:10**: سَيَذَّكَّرُ مَن يَخْشَىٰ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 19** (declared #: 19, id `f130dc88-f857-4594-a088-242a3627677a`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Dans les livres d’Abraham et de Moïse."
- text_sha256: `5d1f00ec60bcda062e51b01390c799d0b25745e76fbf19019e464513646b163d`
- Canonical target(s): 87:19
- Per-join mapping_confidence: 87:19=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **87:19**: صُحُفِ إِبْرَٰهِيمَ وَمُوسَىٰ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S87 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com,
decision `phase5-017-tier3-t3-s87-approve` — accelerated 7-surah batch, deterministic replacement
sample) Applied to all 3 frozen segments' `alignment_status` and all 3 join
rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`). Full
reviewer notes are in `PHASE5-REVIEW-DECISIONS.json`.

---

### T3-S91 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 15. Proposed ordinals: 1, 8, 15.

**Ordinal 1** (declared #: 1, id `5615c263-4d60-4c3c-aaaa-caf3a91042c8`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "J’en jure par le SOLEIL et sa clarté,"
- text_sha256: `5a519db0157785fbd09628b8ad44758b7dfcc4409d44258ad5b72182d96da525`
- Canonical target(s): 91:1
- Per-join mapping_confidence: 91:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **91:1**: وَٱلشَّمْسِ وَضُحَىٰهَا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 8** (declared #: 8, id `28290bee-8145-4be6-89e6-ab203857656a`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Et qui lui a inspire sa méchanceté et sa piété ;"
- text_sha256: `8983785425e0520b39a5045a71ba71b2fcf4cb64bf5d7f8583f6b80d937305d6`
- Canonical target(s): 91:8
- Per-join mapping_confidence: 91:8=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **91:8**: فَأَلْهَمَهَا فُجُورَهَا وَتَقْوَىٰهَا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 15** (declared #: 15, id `2c54b042-87a8-4dfb-a7e3-4bf2f86d9feb`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Et il n’en redoute point les suites."
- text_sha256: `6c9b3d5298010c43b7cf40a8adde66446de5d7f660c90db0d44776a126c99ab2`
- Canonical target(s): 91:15
- Per-join mapping_confidence: 91:15=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **91:15**: وَلَا يَخَافُ عُقْبَـٰهَا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S91 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com,
decision `phase5-018-tier3-t3-s91-approve` — accelerated 7-surah batch, deterministic replacement
sample) Applied to all 3 frozen segments' `alignment_status` and all 3 join
rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`). Full
reviewer notes are in `PHASE5-REVIEW-DECISIONS.json`.

---

### T3-S100 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 11. Proposed ordinals: 1, 6, 11.

**Ordinal 1** (declared #: 1, id `7c846c0b-0389-4812-90ad-410e813c1769`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "J’en jure par les COURSIERS haletants,"
- text_sha256: `b321fb7189470e1200e5b79af568e3190dfeaf65ed5de2f0e5065ac5f8c0ba12`
- Canonical target(s): 100:1
- Per-join mapping_confidence: 100:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **100:1**: وَٱلْعَـٰدِيَـٰتِ ضَبْحًا
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 6** (declared #: 6, id `7d30cad0-6182-463a-8225-a983b524752e`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "En vérité, l’homme est ingrat envers son Seigneur."
- text_sha256: `137831aa3c112ae7766c001a9d5db7db2817ef2213fe4494936b956873f73277`
- Canonical target(s): 100:6
- Per-join mapping_confidence: 100:6=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **100:6**: إِنَّ ٱلْإِنسَـٰنَ لِرَبِّهِۦ لَكَنُودٌ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 11** (declared #: 11, id `f9316e4d-16d0-46c7-9c1e-b9890d319cb4`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Que Dieu sera instruit alors de ses actions ?"
- text_sha256: `2cd1591ea52319c365a5e23dd1808c31391b93cafcbaac17c3404e24f5f8a679`
- Canonical target(s): 100:11
- Per-join mapping_confidence: 100:11=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **100:11**: إِنَّ رَبَّهُم بِهِمْ يَوْمَئِذٍ لَّخَبِيرٌۢ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S100 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com,
decision `phase5-019-tier3-t3-s100-approve` — accelerated 7-surah batch, deterministic replacement
sample) Applied to all 3 frozen segments' `alignment_status` and all 3 join
rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`). Full
reviewer notes are in `PHASE5-REVIEW-DECISIONS.json`.

---

### T3-S102 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 8. Proposed ordinals: 1, 4, 8.

**Ordinal 1** (declared #: 1, id `0c3fba65-eb58-4815-9e82-0c4482facbf9`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Le désir d’augmenter vos richesses vous préoccupe"
- text_sha256: `41188b082abfe216354342550e11f9adfa583d43ae19fe2476cc3fd1aecf3992`
- Canonical target(s): 102:1
- Per-join mapping_confidence: 102:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **102:1**: أَلْهَىٰكُمُ ٱلتَّكَاثُرُ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 4** (declared #: 4, id `25eecd65-c631-463b-bc60-d35395008f24`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Encore une fois, vous apprendrez ce qui en est."
- text_sha256: `dacfbf644b1dea384d3eb7b872a641e42759cf412514899e99bd7754bf6ffc6c`
- Canonical target(s): 102:4
- Per-join mapping_confidence: 102:4=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **102:4**: ثُمَّ كَلَّا سَوْفَ تَعْلَمُونَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 8** (declared #: 8, id `dabc5f8f-0529-46ed-88ba-26e9d64d53c6`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Alors voilà serez interrogés au sujet des plaisirs de ce monde."
- text_sha256: `762f92c39482a370245414a0dc8a5489ba74099897974a38f8a1efade8d28f88`
- Canonical target(s): 102:8
- Per-join mapping_confidence: 102:8=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **102:8**: ثُمَّ لَتُسْـَٔلُنَّ يَوْمَئِذٍ عَنِ ٱلنَّعِيمِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S102 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com,
decision `phase5-020-tier3-t3-s102-approve` — accelerated 7-surah batch, deterministic replacement
sample) Applied to all 3 frozen segments' `alignment_status` and all 3 join
rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`). Full
reviewer notes are in `PHASE5-REVIEW-DECISIONS.json`.

---

### T3-S103 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 3. Proposed ordinals: 1, 2, 3.

**Ordinal 1** (declared #: 1, id `3fe6a511-49f7-4486-bed3-5f73b687d56a`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "J’en jure par l’heure de l’APRÈS-MIDI."
- text_sha256: `56fcec2268a5a856e571c8be41a3e7e41fdcdc508087430365e684dbb2ef98c8`
- Canonical target(s): 103:1
- Per-join mapping_confidence: 103:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **103:1**: وَٱلْعَصْرِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 2** (declared #: 2, id `5c374484-97a2-4130-adfb-4b8343cc19bc`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "L’homme travaille à sa perte."
- text_sha256: `9ec4a1a3e98a24d76f43e68b61b088e683ca6b62104327513e337ce1d9f40e85`
- Canonical target(s): 103:2
- Per-join mapping_confidence: 103:2=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **103:2**: إِنَّ ٱلْإِنسَٰنَ لَفِى خُسْرٍ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 3** (declared #: 3, id `691f18bd-031b-4a7c-8104-f1ae149616e4`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Tu en excepteras ceux qui croient et pratiquent les bonnes œuvres, qui se recommandent mutuellement la vérité et la patience."
- text_sha256: `e18a281513449eb95a1885dcab43e9e6223d0639f051562cd78b46b35c2543d8`
- Canonical target(s): 103:3
- Per-join mapping_confidence: 103:3=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **103:3**: إِلَّا ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّٰلِحَٰتِ وَتَوَاصَوْا۟ بِٱلْحَقِّ وَتَوَاصَوْا۟ بِٱلصَّبْرِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S103 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com,
decision `phase5-021-tier3-t3-s103-approve` — accelerated 7-surah batch, deterministic replacement
sample) Applied to all 3 frozen segments' `alignment_status` and all 3 join
rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`). Full
reviewer notes are in `PHASE5-REVIEW-DECISIONS.json`.

---

### T3-S105 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 5. Proposed ordinals: 1, 3, 5.

**Ordinal 1** (declared #: 1, id `5ffec345-75a2-43c3-8df5-f0f478b5740d`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "As-tu vu comment le Seigneur a traité les hommes à L’ÉLÉPHANT ?"
- text_sha256: `0e2d6c1921589188fedb8ae3b6b7f065058a34e547b508dfe3ff1d92ef60f8df`
- Canonical target(s): 105:1
- Per-join mapping_confidence: 105:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **105:1**: أَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِأَصْحَـٰبِ ٱلْفِيلِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 3** (declared #: 3, id `83955dad-1162-48eb-bf8b-5088eb560a89`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "N’a-t-il pas envoyé contre eux les oiseaux ababils,"
- text_sha256: `6a11cc4e5d04f15ac6f42bcc4594221b96b7d2482d013333fe4c0ad94ba84137`
- Canonical target(s): 105:3
- Per-join mapping_confidence: 105:3=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **105:3**: وَأَرْسَلَ عَلَيْهِمْ طَيْرًا أَبَابِيلَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 5** (declared #: 5, id `89e0ab65-f293-4841-8279-e5dc392c0ad0`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Il en a fait comme de la balle dont la grain a été mangé."
- text_sha256: `72e74cb1e6f27de66622a5d65044a8fe41904155b76af97a0a1f5098c331e065`
- Canonical target(s): 105:5
- Per-join mapping_confidence: 105:5=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **105:5**: فَجَعَلَهُمْ كَعَصْفٍ مَّأْكُولٍۭ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S105 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com,
decision `phase5-022-tier3-t3-s105-approve` — accelerated 7-surah batch, deterministic replacement
sample) Applied to all 3 frozen segments' `alignment_status` and all 3 join
rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`). Full
reviewer notes are in `PHASE5-REVIEW-DECISIONS.json`.

---

### T3-S107 — proposed first/middle/last sample (NOT Phase 4's original sample — see §2–3)

Total eligible segments in this surah: 7. Proposed ordinals: 1, 4, 7.

**Ordinal 1** (declared #: 1, id `19c58cd6-e13f-4493-807d-625263df3d7c`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Que penses-tu de celui qui traite cette religion de mensonger ?"
- text_sha256: `a488ec92bbd29de180a78125d198c1cee6ac459d902bc78b1f7f2c84e25bbcc5`
- Canonical target(s): 107:1
- Per-join mapping_confidence: 107:1=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **107:1**: أَرَءَيْتَ ٱلَّذِى يُكَذِّبُ بِٱلدِّينِ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 4** (declared #: 4, id `a4cc2042-2467-4989-b93e-3994a24611e5`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Malheur à ceux qui font la prière,"
- text_sha256: `417b5d7479ce106e8a174e729741e59c67a115523a0895926b5ebdf12882ad4c`
- Canonical target(s): 107:4
- Per-join mapping_confidence: 107:4=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **107:4**: فَوَيْلٌ لِّلْمُصَلِّينَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**Ordinal 7** (declared #: 7, id `62bc0d4a-2475-423e-b51c-e982fa4f5701`)
- Alignment type: `direct` · Segment status: `auto_verified`
- French text (verbatim): "Et refusent d’acquitter L’AUMÔNE nécessaire à ceux qui en ont besoin !"
- text_sha256: `2eeb2b5e7d163a5e64b365b633d58b132c920ca4dd56e5aed3f6843060718fc7`
- Canonical target(s): 107:7
- Per-join mapping_confidence: 107:7=auto
- Also maps to another canonical āyah: NO
- Canonical Arabic:
  - **107:7**: وَيَمْنَعُونَ ٱلْمَاعُونَ
- HUMAN DECISION: ____________
- HUMAN NOTES: ____________

**T3-S107 DECISION: APPROVE** (recorded 2026-09-01, amkristian91@gmail.com,
decision `phase5-023-tier3-t3-s107-approve` — accelerated 7-surah batch, deterministic replacement
sample) Applied to all 3 frozen segments' `alignment_status` and all 3 join
rows' `mapping_confidence` (`auto_verified`/`auto` → `human_verified`). Full
reviewer notes are in `PHASE5-REVIEW-DECISIONS.json`.

---

