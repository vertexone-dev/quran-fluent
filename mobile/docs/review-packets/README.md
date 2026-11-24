# Source review packets

QR-DESIGN-007D. Three packets, one per independent role, for the source-verification workflow (`../SOURCE-VERIFICATION-WORKFLOW.md`).

| Packet                                                                     | Role                          | Sources in scope                                |
| -------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| [ARABIC-TEXT-REVIEW-PACKET.md](ARABIC-TEXT-REVIEW-PACKET.md)               | Arabic / Qur'an text reviewer | Tanzil Uthmani 1.1 (Candidate)                  |
| [FRENCH-TRANSLATION-REVIEW-PACKET.md](FRENCH-TRANSLATION-REVIEW-PACKET.md) | French translation reviewer   | Kazimirski via Wikisource (Candidate)           |
| [LEGAL-LICENSING-REVIEW-PACKET.md](LEGAL-LICENSING-REVIEW-PACKET.md)       | Legal / licensing reviewer    | all three; Pickthall (Verified) for maintenance |

**No reviewer has been named, appointed or approved, and no source status has changed.** Every name, qualification, date and signature in these packets is blank on purpose. A packet becomes evidence only when a real reviewer fills and signs it.

## Rules for every packet

1. **Independence.** A reviewer did not import, transform or previously sign off the text they review, and is not another packet's reviewer for the same source. Reviewers do not see each other's findings until both have submitted.
2. **Nothing is corrected during review.** A difference is recorded in the findings log and escalated. Text is never edited to make a check pass.
3. **Status stays as it is.** A reviewer's sign-off is evidence for the owner's decision; it does not change `verification_status`. Only an owner-approved, reviewed migration can.
4. **Fail safe.** One open blocker finding means the source stays Candidate (or is downgraded if Verified).
5. **Record everything** in [FINDINGS-LOG-TEMPLATE.md](FINDINGS-LOG-TEMPLATE.md): one row per finding, whether or not it is a defect. "Reviewed, no difference" is also recorded, with the scope covered.
6. **Reproducibility first.** Start from the reproducible rebuild (`mobile/CONTENT-REBUILD.md` on the CI branch `ci/qr-design-007d-reproducible-content`, local until approved). It shows the approved content equals the content committed in the repository. It does **not** show that content equals the original sources; that is what these reviews are for.

## Evidence common to all packets

| Evidence                  | Where                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved content identity | content fingerprint `b586ba395b9508f1918175bc1c37e0c113ed5c6505a0aa6fec4286469d1225b1`; counts 114 / 6,236 / 6,236 / 6,239 / 6,396 (`mobile/content-db.expected.json`) |
| Reproducible rebuild      | `mobile/scripts/rebuild-content-core.mjs`, pinned inputs in `mobile/content-sources.lock.json`; zero row differences against the approved database                     |
| Source records            | `PHASE8C-CONTENT-SOURCE-GOVERNANCE.md` sections 3 and 6; migration headers                                                                                             |
| What the app shows        | About & Sources screen reads `content_sources`; statuses are never upgraded                                                                                            |

## How findings are decided

| Severity | Meaning                                                                       | Effect                                            |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Blocker  | Substantive text difference, wrong provenance, or a licence condition not met | Source cannot be promoted; owner informed at once |
| Major    | Unexplained difference or missing evidence that could hide a blocker          | Must be resolved before promotion                 |
| Minor    | Formatting-only or documentation gap with no effect on meaning                | Recorded; may be accepted by the owner            |
| Info     | Observation                                                                   | Recorded                                          |

- [REVIEWER-PACKAGES.md](REVIEWER-PACKAGES.md): the three reviewer packages and their questions (QR-RELEASE-001).
- [BOOTSTRAP-58-AYAH-PROVENANCE.md](BOOTSTRAP-58-AYAH-PROVENANCE.md): where the 58 early ayahs came from and what is unresolved (007E).
