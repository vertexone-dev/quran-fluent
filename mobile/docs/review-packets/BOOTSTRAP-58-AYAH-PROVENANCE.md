# Provenance of the 58 bootstrap ayahs (QR-DESIGN-007E)

Written for the project owner, the Arabic reviewer and the legal reviewer. Evidence comes only from files in this repository and from a read-only inspection of a temporary copy of the database rebuilt in 007E. Nothing was downloaded, and no database or source status was changed.

## What the 58 are

Ayahs of surahs 1, 67, 103, 108, 112, 113 and 114 (7 surahs). They are the only Arabic rows that did not come from the Tanzil import.

## Chain of custody found in the repository

| Step                           | Evidence                                                                                                  | What it says                                                                                                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seeded 2026-08-18              | migration `20260818042151` header                                                                         | Arabic from **api.alquran.cloud**, edition `quran-uthmani`, described there as "Tanzil/King Fahd Complex standard digital Mushaf text". English Sahih International, French Hamidullah. Bismillah stripped from ayah 1 of six surahs (not Al-Fatiha) using the source's own string. |
| Cross-check at the time        | same header                                                                                               | Compared with api.quran.com v4 `text_uthmani`. Equal in wording; "only differences" were tatweel and small annotation marks. The comparison output was not kept.                                                                                                                    |
| Re-validation claim 2026-08-20 | migrations `20260820140000`, `20260820160000` headers; `generate-arabic-migration.mjs` aborts on mismatch | "0 substantive discrepancies" against a fresh Tanzil fetch. "Substantive" is not defined, and the comparison output was not kept.                                                                                                                                                   |
| Attribution backfill           | `20260820140000`                                                                                          | `ayahs.arabic_source_id` set to the **Tanzil** source for these 58 rows, justified by that re-validation. The Tanzil import used `ON CONFLICT DO NOTHING`, so the 58 rows were never replaced by Tanzil text.                                                                       |

## Facts measured in 007E (temporary copy, read-only)

- The 58 rows use no character that the Tanzil stratum lacks.
- The Tanzil stratum contains waqf signs U+06D7 (603 times) and U+06D9 (68 times) that never occur in the 58. This may only reflect the short length of those ayahs; it was not tested further.
- **Tatweel (U+0640): 2 in the 58 (0.03 per ayah) against 6,479 in the other 6,178 (1.05 per ayah).** This is consistent with the header's remark that the two digitisations differ in tatweel and annotation marks, and it means the 58 are **not byte-identical to what a Tanzil fetch of the same ayahs would give**.
- Not all 58 are in NFC form. Different Unicode forms of the same text are therefore mixed inside the database.

## Comparison with the official Tanzil file (2026-11-23, read-only)

Source: `https://tanzil.net/pub/download/index.php?quranType=uthmani&marks=true&sajdah=true&alef=true&tatweel=true&outType=txt-2`. The file is headed "Tanzil Quran Text (Uthmani, Version 1.1), Copyright (C) 2007-2026 Tanzil Project, License: Creative Commons Attribution 3.0". Its SHA-256 is `6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f`, equal to the checksum pinned in migration `20260820160000`. The file was kept outside the repository and is not committed or redistributed.

Terms printed in the file: verbatim copying and distribution only ("changing it is not allowed"); credit "Tanzil Project" with a link to tanzil.net; the copyright block must be reproduced in files derived from or containing a substantial portion of the text.

Result for the 58 rows (from a rebuilt copy of the approved content):

| Outcome                                                       | Ayahs |
| ------------------------------------------------------------- | ----- |
| Byte-identical to Tanzil                                      | 21    |
| Differ                                                        | 37    |
| of which differ only by tatweel and small marks               | 31    |
| of which differ because the Bismillah was removed from ayah 1 | 6     |

Letter skeletons (base letters, ignoring marks) are identical for 52 of 58. In the other 6 the only difference is the Bismillah prefix that Tanzil's file carries on ayah 1 and that the database deliberately strips (surahs 67, 103, 108, 112, 113, 114). Mark-level differences: Tanzil has 35 tatweel signs that the database lacks; the database has 21 small low meem (U+06ED) and 14 small high meem isolated form (U+06E2) signs that Tanzil lacks. No wording difference was found.

So the earlier claim "0 substantive discrepancies" holds for wording, but the 58 rows are **not Tanzil's text** as distributed, and the Bismillah removal is an edit relative to Tanzil's "changing it is not allowed" terms.

Also found: the migration `20260820160000` header carries checksums but not Tanzil's copyright block; the licence appears only in the `20260820110000` source row.

## Unresolved questions

1. **Attribution.** The database credits Tanzil for text that came from api.alquran.cloud. Tanzil's terms require exact attribution and no changes; is the credit accurate, and is api.alquran.cloud's own licence for this edition recorded anywhere? No licence text for api.alquran.cloud is in the repository.
2. **"No changes" condition.** The Bismillah was stripped from six ayah-1 rows. For the Tanzil import a separate split is also done. Legal reviewer: does either count as a change?
3. **Equivalence is asserted, not evidenced.** Neither comparison (api.quran.com, Tanzil) left an artefact. Arabic reviewer: compare all 58 with the Tanzil file and with a non-Tanzil reference (KFGQPC), and decide whether tatweel and waqf differences matter.
4. **Mixed Unicode forms** (NFC against non-NFC) in one table; search and exact-match behaviour may differ between the two strata.
5. **French Hamidullah rows (58 `translations`)** carry status `disputed` (consent objection, 1989 open letter). The app never selects them; the question is whether to keep them in the bundled database at all.
6. **Other open licence questions** (full list in the legal packet): the Tanzil full-text migration header carries a checksum but no copyright or licence line, in a public repository; the Wikisource transcription behind Kazimirski; Pickthall recorded public-domain for the United States only.

## Recommended next steps (owner decisions)

- Reviewer comparison of the 58 against two references, recorded in the findings log.
- If the credit is inaccurate, correct the attribution in a reviewed migration (not done here; no source or status was changed).
- Decide about the disputed Hamidullah rows.
