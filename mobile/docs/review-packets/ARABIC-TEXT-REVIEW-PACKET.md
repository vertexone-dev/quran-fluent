# Arabic / Qur'an text review packet: Tanzil Uthmani 1.1

Reviewer: _not yet named_. Status of the source today: **Candidate**. This packet does not change it.

## 1. Question for the reviewer

Is the Arabic text stored for all 6,236 ayahs, as the app shows it, free of any rasm, diacritic or wording difference from an independent Hafs / Uthmani reference that is not derived from Tanzil?

## 2. What the reviewer receives

| Item                         | Detail                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored text identity         | the 6,236 `(surah, ayah)` entries, reproducible with `rebuild-content-core.mjs`; the project supplies the list as a private working file, not as a publication                                                                                                                                                                                                                                        |
| Source on record             | Tanzil Project, Uthmani Script version 1.1 (Feb 2021), CC BY 3.0. Artifact SHA-256 `6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f`; metadata XML SHA-256 `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a` (recorded in the import migration header; **not** yet in the database notes)                                                                           |
| Import options               | mark-preserving: pause marks, sajdah markers, superscript alef and tatweel retained                                                                                                                                                                                                                                                                                                                   |
| Transformation history       | (1) the Bismillah prefix is split from ayah 1 of every surah except Al-Fatiha (where it is ayah 1) and At-Tawba (which has none); the Bismillah string was derived from Al-Fatiha's own stored text; surahs 95 and 97 have a shadda-idgham Bismillah that was recognised and separated; (2) nothing else                                                                                              |
| **Open provenance question** | the 58 ayahs of surahs 1, 67, 103, 108, 112, 113 and 114 were seeded from `api.alquran.cloud` (edition `quran-uthmani`), not from the Tanzil download, and were cross-checked against `api.quran.com` v4 (formatting-only differences). They are credited in the database as Tanzil Uthmani. The reviewer should treat them as a separate stratum and confirm their source (see the legal packet, L5) |
| Numbering                    | Cairo 1925 (King Fuad), 6,236 ayahs; per-surah counts were checked only against Tanzil's own metadata (self-consistency, not independence)                                                                                                                                                                                                                                                            |
| Existing validation          | structural gates only (114 surahs, counts, no blank, duplicate or out-of-range rows, Bismillah rule); a 58-ayah comparison against a second digitization. No full independent comparison is on record                                                                                                                                                                                                 |

## 3. Reference and method

1. **Reference.** An independent Hafs / Uthmani digitization not derived from Tanzil: primarily the King Fahd Glorious Qur'an Printing Complex digital text; optionally corroborated by the Quranic Arabic Corpus. (`api.quran.com`'s `text_uthmani` is itself Tanzil-derived and is only weakly independent.) The reviewer records the exact reference, version, URL, retrieval date and file SHA-256 **before** comparing.
2. **Normalise** both sides to Unicode NFC. Do not strip marks.
3. **Compare** every ayah, character by character, keyed by `(surah, ayah)`. The Bismillah split is applied to the reference the same way, documented, before comparing.
4. **Classify** each difference: (a) annotation-mark, tatweel or pause-mark formatting; (b) rasm, diacritic or wording.
5. **Escalate**: any category (b) difference stops the review and is raised at once.
6. **Qualified judgement.** Whether a category (a) difference is acceptable is a judgement for the reviewer, stated in the log.

## 4. Acceptance criteria (all required)

- [ ] Reference identified and recorded before comparison (name, edition, version, retrieval date, SHA-256).
- [ ] All 6,236 ayahs compared (not a sample), including the 58-ayah stratum reported separately.
- [ ] **Zero category (b) differences**, or every one explained and resolved by the owner in writing with the source unchanged until then.
- [ ] Every category (a) difference listed with the reviewer's acceptance or rejection.
- [ ] Bismillah split, surahs 95 and 97, Al-Fatiha and At-Tawba checked and recorded.
- [ ] Independence declaration signed; reviewer qualification stated.

## 5. What the reviewer returns

The completed [findings log](FINDINGS-LOG-TEMPLATE.md) with the full difference report attached (as a file hash plus the file), and a signed recommendation. After sign-off the project adds the artifact and an aggregate ordered SHA-256 of the stored text to the database notes (a metadata-only reviewed migration) and pins the aggregate in the validator. The text itself is never edited as part of review.

## 6. Out of scope

Tafsir, translation meaning, recitation rules (tajwid colouring), word-by-word data, audio, and any change to the stored text.

## 7. Addendum (QR-DESIGN-007E): the 58 bootstrap ayahs

These 58 rows came from a different digitisation (api.alquran.cloud) than the other 6,178 (Tanzil), and differ in tatweel and annotation marks. Please compare all 58 with the Tanzil file and a non-Tanzil reference and log every difference. Details: [BOOTSTRAP-58-AYAH-PROVENANCE.md](BOOTSTRAP-58-AYAH-PROVENANCE.md).

The whole database can now be rebuilt from repository files without production access, so the text you review is reproducible: see `mobile/scripts/full-rebuild/`. The rebuilt content matches the approved fingerprints.
