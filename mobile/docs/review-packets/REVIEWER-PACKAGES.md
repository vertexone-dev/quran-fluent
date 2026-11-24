# Reviewer packages (QR-RELEASE-001)

Three independent reviewers, three packages. Nobody here approves on a reviewer's behalf; the owner names the reviewers. No Quran text or source status is changed by this work: Tanzil and Kazimirski stay **Candidate**, Pickthall stays **Verified**, Hamidullah stays **disputed and excluded** (58 rows, never selected by the app).

All three packages assume the database can be rebuilt without production access: `mobile/scripts/full-rebuild/rebuild-full-database.sh` (draft PR #92) reproduces the approved content, and the GitHub run 45172445848 proved it on a runner. Reviewers should be given the rebuilt file, not a production export.

## A. Arabic reviewer

| Item                                                    | Where                                                                                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packet                                                  | `ARABIC-TEXT-REVIEW-PACKET.md` (with the 007E addendum)                                                                                                         |
| 58 bootstrap ayahs: provenance and measured differences | `BOOTSTRAP-58-AYAH-PROVENANCE.md`                                                                                                                               |
| Tanzil reference                                        | official Uthmani v1.1 file, SHA-256 `6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f` (the reviewer downloads it; it is not in the repository) |

Questions to answer and log in `FINDINGS-LOG-TEMPLATE.md`:

1. For each of the 58 ayahs (surahs 1, 67, 103, 108, 112, 113, 114): is the wording correct against Tanzil and a non-Tanzil reference (KFGQPC)? Known: 21 identical, 31 differ in tatweel or small marks only, 6 differ by the removed Bismillah prefix; no wording difference found.
2. Are the mark differences (U+06ED, U+06E2, tatweel) acceptable for display, search and memorisation?
3. Is removing the Bismillah from ayah 1 of surahs 67, 103, 108, 112, 113, 114 correct for a numbered model, and is it documented to the reader?
4. Sample of the other 6,178 ayahs against a second reference.

## B. French reviewer

| Item                     | Where                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packet                   | `FRENCH-TRANSLATION-REVIEW-PACKET.md`                                                                                                                                                                             |
| Kazimirski alignment     | `scripts/quran-import/kazimirski/kazimirski_alignment_manifest.json` (SHA-256 `04c6d562a440f661bf4b80d690c877b8691eed567ec55cb1062937e05a2f8a1e`): 6,239 segments, 6,396 segment-to-ayah joins, 57 human-verified |
| Reproducible sample      | `node mobile/scripts/draw-review-sample.mjs --seed <text> --size <N>`; record the seed before the reviewer sees any text                                                                                          |
| Application localisation | French interface strings in `mobile/src` locale files and the web locale files; wording is a draft until native review                                                                                            |

Scope: Kazimirski translation accuracy and alignment to the right ayah; archaic French and OCR/transcription errors; the French application text. Out of scope: Hamidullah (disputed, excluded; the app never selects it).

## C. Legal reviewer

| Item                                         | Where                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Packet                                       | `LEGAL-LICENSING-REVIEW-PACKET.md` (with the 007E addendum)                                                                        |
| Tanzil terms as printed in the official file | CC BY 3.0; verbatim copies only; credit "Tanzil Project" with a link to tanzil.net; reproduce the copyright block in derived files |

Questions:

1. Tanzil: does stripping or splitting the Bismillah count as "changing" the text? Is redistribution inside the app and inside the public repository's migrations allowed?
2. The public migration `20260820160000` carries checksums but not Tanzil's copyright block. Required, and where?
3. The 58 bootstrap ayahs came from api.alquran.cloud but are credited to Tanzil. Correct credit, and what is that service's licence?
4. Kazimirski: Wikisource transcription licence (revision id still to be recorded) and the scanned edition's status.
5. Pickthall: recorded public domain for the United States only; is worldwide distribution allowed in the app stores' territories?
6. Artwork: AI-generated images have no written commercial-rights record (see `docs/QR-INT-005-HERO-ASSET-LICENSING.md`); they are blocked from release builds.
