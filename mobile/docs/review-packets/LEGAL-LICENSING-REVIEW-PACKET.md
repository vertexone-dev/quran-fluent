# Legal and licensing review packet

Reviewer: _not yet named_. This is a set of questions and evidence, not legal advice and not a conclusion. Nothing here asserts that any use is permitted or prohibited.

## 1. Scope

Distribution of the bundled Quran content in the free mobile apps (Android, iOS) worldwide, and the public GitHub repository that contains the same text in its migrations.

## 2. Sources and facts on record

| Source                                                   | Facts on record (from the database and the repository)                                                                                                                                                                                                                                                                                                                                                                                                                                                     | What is displayed to users                                                                                                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tanzil Uthmani 1.1, status **Candidate**                 | Licence "Creative Commons Attribution 3.0"; attribution required; modification restricted. Tanzil's terms (read on 2026-11-22 at `https://tanzil.net/docs/Text_License`) state: the text may be used if the source (Tanzil Project) is clearly indicated; a link to tanzil.net is made; copying and distributing verbatim copies is permitted; changing it is not allowed; the copyright notice must be reproduced appropriately in all files derived from or containing a substantial portion of the text | About & Sources shows the notice "Tanzil Quran Text (Uthmani, version 1.1). Copyright 2007-2021 Tanzil Project, licensed under Creative Commons Attribution 3.0. Source: tanzil.net" and a tappable link |
| Pickthall, Project Gutenberg #16955, status **Verified** | Licence recorded as "Public Domain (United States)"; attribution not required by the record; the file is "Three Translations of The Koran (Al-Qur'an) side by side"                                                                                                                                                                                                                                                                                                                                        | Translator and source credited                                                                                                                                                                           |
| Kazimirski, Wikisource, status **Candidate**             | Licence recorded as "Public domain"; attribution recorded as required; text transcribed by Wikisource contributors from an 1869 printing                                                                                                                                                                                                                                                                                                                                                                   | Translator and source credited                                                                                                                                                                           |
| Hamidullah (disputed) and legacy Kazimirski (deprecated) | Never bundled or displayed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | none                                                                                                                                                                                                     |

## 3. Questions for the reviewer

- **L1 (Tanzil terms).** Are the project's uses within the licence: display in the app, storage in a database, and copying into repository migrations?
- **L2 (attribution).** Is the About & Sources credit sufficient (notice, licence name, link)? Should the licence URL also be shown?
- **L3 (modification).** The stored text differs from Tanzil's download in one documented way: the Bismillah prefix is split from ayah 1 of most surahs, and the 58 bootstrap ayahs came from another digitization. Does this count as a "change"? Is the app's display of the split text acceptable?
- **L4 (redistribution).** The migration that holds the full Tanzil text (`20260820160000_*`) names the source and its checksum but **does not contain the copyright notice or licence line** that Tanzil's terms ask to appear in files containing a substantial portion of the text. Is that a problem, and if so, is the remedy a comment-only change to an applied migration (which would require updating the pinned hash in `content-sources.lock.json`) or something else? The repository is public.
- **L5 (provenance of the 58 bootstrap ayahs).** They were taken from `api.alquran.cloud` (edition `quran-uthmani`). What are that service's terms for this data, and is crediting them to Tanzil accurate?
- **Pickthall.** Is "Public Domain (United States)" enough for worldwide distribution in the app stores, given the translator's date of death? Does the Project Gutenberg compilation add any terms?
- **Kazimirski and Wikisource.** The work is old, but the transcription was produced by Wikisource contributors. What terms, if any, attach to that transcription and to the Wikisource page markup the artifact came from?
- **Artwork (separate).** The locked design references include AI-generated artwork whose commercial-use rights are unresolved; the release guard keeps it out of builds. Not part of this packet's sign-off.

## 4. Evidence to attach

For each source: the licence text archived with URL and date of retrieval; the exact credit text shown in the app (screenshots of About & Sources in English, French and Arabic); the repository paths holding the text; the transformation list in section L3.

## 5. Acceptance criteria (all required for each source before any promotion)

- [ ] Each question above answered in writing, with the reviewer's reasoning and any conditions.
- [ ] Any required notice or wording change identified, with the owner's decision recorded.
- [ ] Redistribution scope (app stores; public repository) confirmed or restricted.
- [ ] Open items (for example L4, L5) closed or accepted by the owner in writing.
- [ ] Independence declaration signed; qualification stated.

## 6. What the reviewer returns

The completed [findings log](FINDINGS-LOG-TEMPLATE.md) with categories L1 to L5 and a signed recommendation. Wording or notice changes are made only by a separate, owner-approved change.

## 7. Addendum (QR-DESIGN-007E): additional questions

1. Credit for the 58 bootstrap ayahs: they came from api.alquran.cloud but are attributed to Tanzil. No api.alquran.cloud licence text is in the repository.
2. The Tanzil migration `20260820160000` carries checksums but no copyright or licence line, in a public repository.
3. The rebuild keeps all Quran text in the public repository's migrations, so the licence question covers redistribution there as well as in the app.
4. Wikisource transcription licence (Kazimirski) and Pickthall's scope (recorded for the United States only) remain unreviewed.

Full detail: [BOOTSTRAP-58-AYAH-PROVENANCE.md](BOOTSTRAP-58-AYAH-PROVENANCE.md).
