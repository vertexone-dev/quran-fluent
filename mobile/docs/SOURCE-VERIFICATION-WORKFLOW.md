# Source verification workflow

QR-DESIGN-007C, Phase 6. **A documented process. No source status was changed, no evidence was collected by this work, and no database was read or modified.** Current statuses are preserved exactly:

| Source (`edition_identifier`)                                      | Status today  |
| ------------------------------------------------------------------ | ------------- |
| Tanzil Uthmani 1.1 (`uthmani`)                                     | **Candidate** |
| Kazimirski French, Wikisource (`kazimirski-1869-segments-v1`)      | **Candidate** |
| Pickthall English, Project Gutenberg (`pickthall-gutenberg-16955`) | **Verified**  |

The mobile About & Sources screen reads these statuses live from the bundled `content_sources` table and never upgrades them, so changing the database record is the only way a label can change.

This workflow builds on the project's own governance record (`PHASE8C-CONTENT-SOURCE-GOVERNANCE.md`, `PHASE8C3-MIGRATION-HISTORY-RECONCILIATION.md`) and its working bar for "verified": the documented, independent, multi-source cross-comparison performed for Pickthall before migration `20260820190000` promoted it. Facts below are taken from that record; none were re-derived from the database.

## 1. Principles

1. **Evidence, then approval, then a reviewed migration.** No status changes on structural validation alone: "6,236 rows and no gaps" proves completeness, not authenticity.
2. **Independence.** The reviewer is not the person who imported the text, and the comparison reference is not derived from the source under review.
3. **Fail safe.** A discovered defect downgrades a source to Candidate immediately, before the fix.
4. **Text is never edited to pass a check.** A difference is reported, classified and escalated, never silently corrected.
5. **One status model.** `content_sources.verification_status` accepts only `candidate | verified | disputed | deprecated`. `cross_verified` and `human_verified` belong to translation-segment tables and are not valid here; introducing new values is a separate schema decision.
6. **Nothing changes in the app.** The app only displays the database's status.

## 2. Roles

| Role                 | Responsibility                                                                       | Must not be               |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| Source steward       | Assembles the dossier; runs the automated gates                                      | The sign-off reviewer     |
| Independent reviewer | Performs and signs the textual comparison (qualified for the language and tradition) | The importer of that text |
| Legal reviewer       | Confirms licence, attribution and redistribution scope                               | —                         |
| Project owner        | Approves the promotion and the migration                                             | —                         |

## 3. The dossier

One folder per source, committed as text only (hashes, reports, signed checklists; **no copy of restricted text**): `docs/source-verification/<edition_identifier>/DOSSIER.md` plus `evidence/`. A promotion cannot be proposed until every gate below is complete and linked.

## 4. Gates (every source)

| Gate                                  | Evidence required                                                                                                                                                                                                                         | Automated?                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **G1 Provenance**                     | Exact edition, version, publisher, URL, retrieval date, the retrieved artifact, and for web sources the **revision id** or permanent identifier.                                                                                          | Partly                                   |
| **G2 Version identification**         | Edition identifier, version string and numbering convention recorded in `content_sources` and the dossier; a change of version re-opens the dossier.                                                                                      | Yes                                      |
| **G3 Integrity**                      | Artifact SHA-256 recorded in the repo **and** in `content_sources.notes`; an aggregate ordered SHA-256 of the stored text; the content fingerprint and counts pinned in `content-db.expected.json`; a re-fetch matches the recorded hash. | Yes                                      |
| **G4 Structure**                      | The existing strict validator (27/27 at last record) and the source's own structural checks pass: counts, numbering, no gaps, no empty or duplicate rows.                                                                                 | Yes                                      |
| **G5 Independent textual comparison** | A comparison against an independent reference (per source below), with every difference classified; zero substantive differences.                                                                                                         | Tool-assisted; judgement by the reviewer |
| **G6 Licence and attribution**        | Licence text archived (URL and date), redistribution and modification scope stated, attribution wording approved, and the About & Sources credit present and tested.                                                                      | Partly                                   |
| **G7 Independent review sign-off**    | Reviewer name, qualification, date, scope, method, findings, signature.                                                                                                                                                                   | No                                       |
| **G8 Owner approval**                 | Written approval of the promotion.                                                                                                                                                                                                        | No                                       |
| **G9 Controlled change**              | A guarded, idempotent, reversible migration (mirroring `20260820190000`) that asserts the counts and fingerprint, updates only `verification_status` and `notes`, never touches text, in its own PR with a rollback statement.            | Yes                                      |
| **G10 Monitoring**                    | Validator tripwires stay on; any version change or reported defect re-opens the dossier.                                                                                                                                                  | Yes                                      |

## 5. Source-specific requirements

### 5.1 Tanzil Uthmani 1.1 (Candidate)

**What is already on record:** Tanzil Project Uthmani Script v1.1 (Feb 2021), licence CC BY 3.0. Retrieved artifact SHA-256 `6933e133…` and metadata XML `8867c1d8…` (recorded only in a migration header comment). 58 ayahs were also cross-checked against a second digitization; the other 6,178 were not independently compared.

**Gaps to close:**

- G3: record the artifact hash and an aggregate ordered SHA-256 of `arabic_text` in `content_sources.notes` (metadata-only change) and pin the aggregate in the validator.
- G5 (the substantive gap): compare **all 6,236 ayahs** with an independent Hafs/Uthmani digitization **not derived from Tanzil**, primarily the King Fahd Glorious Qur'an Printing Complex digital text, optionally corroborated by the Quranic Arabic Corpus. Normalise both to Unicode NFC, diff character by character keyed by `(surah, ayah)`, and classify each difference as (a) annotation-mark, tatweel or pause-mark formatting, or (b) rasm, diacritic or wording. **Any category (b) difference stops the process and is escalated.** Zero category (b) differences make the source eligible. The reviewer must be a qualified Qur'anic-text reviewer: this is a scholarly judgement.
- G6: confirm with the legal reviewer whether the project's documented transformations (the Bismillah prefix split from ayah 1 of each surah, retained marks) are compatible with the licence's "no changes" condition, and that the credit shows the copyright notice and links tanzil.net.

### 5.2 Kazimirski French, Wikisource (Candidate)

**What is already on record:** fr.wikisource.org, Charpentier 1869 printing, proofreading status "V", Google Books and Harvard scans; artifact SHA-256 `38f94de9…`; an aggregate ordered segment hash `12015b8f…` over 6,239 segments; the alignment and mapping mechanics were human-reviewed, but there was **no** independent translation-quality sign-off against the Arabic (the project's own open question).

**Gaps to close:**

- G1: record the Wikisource **revision id** the artifact was taken from.
- G5a, transcription fidelity: because Wikisource is a transcription, compare it with the scanned edition. Use a pre-registered stratified random sample of segments across all 114 surahs (size fixed by the steward and reviewer in advance, plus every segment touched by a correction), read by two reviewers independently against the scan. Substantive transcription differences must be zero; any one stops the process.
- G5b, translation and alignment quality: a bilingual reviewer signs off the segment-to-ayah mapping (including the 150 ayahs covered by two or more segments and the 152 segments spanning two or more ayahs, which are documented historical-numbering divergences) against the verified Arabic.
- G6: the work is public domain, but the licensing of the Wikisource transcription itself needs legal review before this source can be called Verified.

### 5.3 Pickthall English, Project Gutenberg (Verified: maintain)

**Evidence on record:** Gutenberg eBook #16955, artifact SHA-256 `8ea8efcd…`, a four-item verse-label correction manifest (wording never altered), and a documented cross-comparison against other candidates. This is the project's reference bar.

**Maintenance:** keep the dossier complete (G1–G4, G6), re-run G3/G4 whenever the file or schema changes, and have the legal reviewer confirm the public-domain scope is adequate for worldwide distribution (the licence row says "Public Domain (United States)"). A failed re-check downgrades the status to Candidate immediately (principle 3).

## 6. Statuses and transitions

- **Candidate to Verified:** only with G1–G8 complete, then G9. The change is one reviewed migration; the About screen then shows "Verified" on its own, because it reads the table.
- **Verified to Candidate:** on any failed re-check or reported defect; no approval needed to downgrade, approval needed to restore.
- **Disputed / Deprecated:** unchanged; the Hamidullah (disputed) and legacy Kazimirski (deprecated) rows are never bundled or displayed.
- **No source is promoted by this document.** Promotion requires evidence and explicit owner approval.

## 7. Suggested tooling (not built)

- `scripts/verify-source-dossier.mjs`: checks a dossier's checklist is complete and its recorded hashes match the database's notes, and refuses a promotion migration otherwise.
- An aggregate Arabic-text hash assertion in the strict validator.
- A recorded Wikisource revision id in `content_sources.notes`.
- A test that the About screen's status always equals the database's status (already present for the three displayed sources).

## 8. Decisions needed from the owner

1. Approve this workflow, or amend it.
2. Name the independent Arabic reviewer, the bilingual French reviewer and the legal reviewer (the process cannot start without people).
3. Authorise the Arabic comparison against a non-Tanzil reference (KFGQPC) and the Kazimirski scan sampling.
4. Decide whether to add new status values (separate schema decision) or keep the four existing ones.
