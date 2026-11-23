# French translation review packet: Kazimirski (Wikisource transcription)

Reviewers: _not yet named_ (two independent readers for the transcription check, plus one bilingual reviewer). Status of the source today: **Candidate**. This packet does not change it.

## 1. Questions for the reviewers

1. **Transcription (T).** Does the stored French text equal the printed 1869 Charpentier edition?
2. **Alignment (A).** Is each segment mapped to the right ayah or ayahs?
3. **Quality (Q).** Is the segment a faithful rendering of the Arabic it is mapped to, within the limits of an 1840 translation?
4. **Language (L).** Is the 19th-century orthography and punctuation preserved, and is there any visible corruption (encoding, markup, stray characters)?

## 2. What the reviewers receive

| Item              | Detail                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source on record  | fr.wikisource.org "Le Koran (traduction de Kazimirski)", Charpentier, Paris, 1869 printing (translation first published 1840); proofreading status "V"; scans: Google Books `3XSe413MJyQC` and a Harvard copy                |
| Frozen artifact   | `texte_entier_raw.html`, SHA-256 `38f94de9e95b8163949d68e69c150ae14343f8799006b58c1fc44fc17f9d0b92` (equals the manifest's `source_artifact_sha256`)                                                                         |
| Stored content    | 6,239 segments and 6,396 segment-to-ayah mappings, committed as `kazimirski_alignment_manifest.json` (phase4-manifest-v2); aggregate ordered segment hash `12015b8f007a41adc36776172d3161d25c0f01a78bdc6a2418fcc6937ee9fc26` |
| Known divergences | 150 ayahs are covered by two or more segments and 152 segments span two or more ayahs (historical numbering differences, documented); two Phase 4 corrections (surahs 2 and 36) recorded in `PHASE4-AMENDMENTS.json`         |
| Earlier review    | alignment and mapping mechanics were human-reviewed (25 decisions, a 53-segment frozen sample); there was **no** independent translation-quality sign-off                                                                    |
| **Not on record** | the Wikisource **revision id** the artifact came from                                                                                                                                                                        |

## 3. Method

**T: transcription fidelity.**

1. The owner fixes a seed and a size (at least 114) and records them **before** the reviewers see any segment. The project supplies the list with `mobile/scripts/draw-review-sample.mjs --seed <seed> --size <N>`: every surah is covered at least once, and the same seed always gives the same list. Segments touched by the Phase 4 amendments and the 25 Phase 5 decisions are added.
2. Two reviewers, working separately, compare each sampled segment with the scanned page and record agreement or the exact difference.

**A and Q: alignment and quality.** A bilingual reviewer checks the mapping of each sampled segment against the verified Arabic, and separately reviews every multi-ayah segment and every multi-segment ayah on the known-divergence list.

**L: language.** Check orthography against the scan; do not modernise. Report mojibake, markup remnants and stray characters.

## 4. Acceptance criteria (all required)

- [ ] Seed and size recorded before review; the sample reproduced independently by a reviewer.
- [ ] **Zero substantive transcription differences** in the sample (a substantive difference changes a word, a name, a number or the sense). One stops the review and widens the sample to all segments of that surah.
- [ ] The two transcription reviewers agree, or disagreements are resolved against the scan.
- [ ] Every multi-ayah segment and multi-segment ayah reviewed and signed off by the bilingual reviewer.
- [ ] The Wikisource revision id recorded in the dossier.
- [ ] Independence declarations signed; qualifications stated.

## 5. What the reviewers return

Three completed [findings logs](FINDINGS-LOG-TEMPLATE.md) (two readers, one bilingual reviewer) and a signed recommendation. After sign-off, the revision id and the review reference go into the database notes by a metadata-only reviewed migration. The text is never edited as part of the review; a transcription error would be fixed upstream or in a separate approved change.

## 6. Out of scope

Choosing a different French translation, modernising language, tafsir, and any change to the stored text.
