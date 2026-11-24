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

## 9. Revision 2 (QR-DESIGN-007D): evaluation against the ten review categories

The ten gates (section 4) were evaluated against ten categories. Gate numbers are kept; two gates are added as "a" gates so nothing is renumbered.

| Category                | Covered by            | Assessment              | Amendment                                                                                                                                                         |
| ----------------------- | --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source identification   | G1, G2                | Adequate                | A web source must record a revision or permanent identifier (Wikisource revision id is missing today)                                                             |
| Provenance              | G1                    | Gap found               | Every **stratum** with a different origin needs its own provenance line. The 58 bootstrap ayahs came from `api.alquran.cloud` yet are credited to Tanzil          |
| Text integrity          | G3, G4, G5            | Adequate                | Hashes are recorded per stratum; the aggregate ordered hash of the stored text is pinned in the validator                                                         |
| Translation attribution | G6                    | Partial                 | G6 must also check that translator, edition, publisher and year match the database fields and the About screen                                                    |
| Licensing               | G6                    | Adequate, role unclear  | The legal reviewer signs G6 using the legal packet; a notice-in-derived-files check is added (the migration holding the full Tanzil text has no copyright notice) |
| Transformation history  | prose in G1 and G6    | **Missing gate**        | **New G6a**                                                                                                                                                       |
| Reproducibility         | G3 (hashes only)      | **Missing gate**        | **New G4a**                                                                                                                                                       |
| Scholarly review        | G5, G7                | Adequate for Arabic     | G7 names a role per packet                                                                                                                                        |
| Language review         | G5 (French, implicit) | Partial                 | G7 adds the French language reviewer (category L in the French packet)                                                                                            |
| Release approval        | G8, G9, G10           | Adequate, scope unclear | Release approval is separate from source approval and checks the displayed statuses, the licence notices and the green release gate                               |

**G4a Reproducibility.** The stored content can be regenerated from pinned, repository-committed inputs and its fingerprint equals the approved one. Evidence: `mobile/scripts/rebuild-content-core.mjs` (CI branch `ci/qr-design-007d-reproducible-content`, local until approved). It proves the approved content equals the committed content. It does not prove authenticity (no network, no re-fetch): that is G5.

**G6a Transformation history.** Every transformation between the original artifact and the stored text is listed, reproducible by a committed script, and reviewed against the licence's modification terms by the legal reviewer. Known: the Bismillah split (Tanzil text), the four Pickthall verse-label corrections (wording unchanged), Kazimirski segmentation and the two Phase 4 corrections.

### 9.1 Where each source stands

"On record" means taken from the project's own records and **not** re-verified in this phase; only G4a was re-run here. Nothing below changes a status.

| Gate                           | Tanzil Uthmani 1.1 (Candidate)                                                                     | Kazimirski (Candidate)                                                | Pickthall (Verified)                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| G1 Provenance                  | Partial: artifact hash on record in a migration header; the 58-ayah stratum has a different origin | Partial: Wikisource page and scans on record; **revision id missing** | On record                                  |
| G2 Version                     | On record (1.1)                                                                                    | On record (1869 printing, manifest v2)                                | On record (eBook #16955)                   |
| G3 Integrity                   | Partial: hashes not in the database notes; no aggregate pinned                                     | On record: artifact and aggregate hashes in the notes                 | On record: artifact hash                   |
| G4 Structure                   | On record (strict validator 27/27 at last record)                                                  | On record                                                             | On record                                  |
| **G4a Reproducibility**        | **Done (re-run in 007D)**: fingerprint and 5 counts equal, 0 row differences                       | **Done (re-run in 007D)**                                             | **Done (re-run in 007D)**                  |
| G5 Independent comparison      | **Open**: no full non-Tanzil comparison                                                            | **Open**: no transcription sample or quality sign-off                 | On record: documented cross-comparison     |
| G6 Licence and attribution     | **Open**: L3, L4, L5 questions                                                                     | **Open**: transcription licence                                       | Maintenance: worldwide public-domain scope |
| **G6a Transformation history** | Partial: documented in the migration, not reviewed                                                 | Partial                                                               | On record (4 corrections)                  |
| G7 Review sign-off             | Not started: no reviewer named                                                                     | Not started: no reviewers named                                       | Not required unless re-opened              |
| G8 Owner approval              | Not started                                                                                        | Not started                                                           | n/a                                        |
| G9 Controlled change           | Not started                                                                                        | Not started                                                           | Done historically (`20260820190000`)       |
| G10 Monitoring                 | Partial                                                                                            | Partial                                                               | Partial                                    |

### 9.2 What this phase does not do

It does not name reviewers, record any review, change any status or edit any stored text. The review packets are in `review-packets/`; the reproducible sample for the French check is `mobile/scripts/draw-review-sample.mjs`.
