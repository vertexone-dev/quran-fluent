# `mobile/public/brand/quranroots-emblem.png`: provenance and rights findings

**Finding: rights cannot be established from any document available to me. Treat as a release blocker until the owner
decides.** Nothing was removed, replaced or modified. No provenance or licence has been invented; where something is
unknown it says so.

## The file

|                   |                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHA-256           | `582b5316fb04b4fe4fb7db5553b6e439b043f30e930ca15bfc2240605f8949c3`                                                                                |
| Format            | PNG, 703 x 483 px, 493,471 bytes, with an alpha channel                                                                                           |
| Embedded metadata | none found (no XMP, creator, copyright, C2PA or generator strings)                                                                                |
| In git            | one commit only: `106f91b` (2026-11-10, "Milestone D-1 Design Lock v1.0 mobile integration (Emergent handoff, verbatim)"), author Moubarak Akamou |

## Origin (as far as the evidence goes)

1. Identical bytes (same SHA-256) exist in Emergent's delivery folder `~/Desktop/CDL Prep/QuranRoots_Final_Delivery/`, in
   `frontend/public/assets/brand/`, `mobile/public/brand/` and both native asset folders.
2. That delivery's `frontend/src/quranroots/README.md` states: `brand/quranroots-emblem*.png, favicon.png,
apple-touch-icon.png` are "**Pixel-extracted from `04_official_logo.png` (background removed by script). Request vector
   master for production.**" Its mobile README says the same, and that the Android and iOS icons and splash screens were
   generated from this emblem by `scripts/generate_icons.py`.
3. `04_official_logo.png` is one of the five Design Lock originals. The Design Lock README describes the five as "original
   generated PNG files". Emergent's delivery says its hero and banner art is AI-generated and to "confirm your licence terms
   for AI imagery before commercial use".
4. So the emblem is **a background-removed extraction of a generated image**, delivered by Emergent. Not established:
   which tool generated `04_official_logo.png`, under whose account, on what date, under which terms, or whether anyone
   created the logo before the generated image existed.
5. The commit message records the handoff patch's SHA-256 (`bdc83801…`), but I could not match it to a file on this
   machine (the Final Delivery zip hashes differently), so I could not verify the handoff chain beyond the byte match in (1).

## Rights documentation available

None for the emblem. The repository's rights review (`docs/QR-INT-005-HERO-ASSET-LICENSING.md`) concerns the hero art and
found no licence, terms record or assignment for Emergent's generated images; it concluded commercial rights "cannot be
established" and noted that prompt-only AI output may not be copyrightable (so exclusivity could not be assumed either).
`mobile/ARTWORK-RELEASE.md` lists the emblem as "the approved Design Lock logo and emblem, not gated by this guard": that
records the owner's design approval and the guard's scope, **not** a rights finding. `scripts/lib/art-manifest.json` marks
`public/quranroots-logo.png` and `favicon.png` "approved" but has no entry for the emblem.

## Where it is used

| Location                                                                            | Use                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobile/src/artwork.ts` (`EMBLEM_LARGE_SRC`)                                        | single source of the path                                                                                                                                                                                                         |
| `mobile/src/screens/SplashScreen.tsx`                                               | splash emblem                                                                                                                                                                                                                     |
| `mobile/src/screens/OnboardingScreen.tsx`                                           | onboarding emblem                                                                                                                                                                                                                 |
| `mobile/android/app/src/main/res/**`, `mobile/ios/App/**` (30 icon and splash PNGs) | launcher icons and splash screens, committed in `106f91b`, described by the delivery as generated from this emblem. Not byte-compared here                                                                                        |
| Website                                                                             | does not use this file. `public/quranroots-logo.png` (240 x 216, `b72ee43bdab5d82c`) and `favicon.png` serve the website; their origin was not traced here, and the delivery's README names the same extraction for `favicon.png` |

The emblem is the app's brand mark and the source of its store icons, so the uncertainty reaches the launcher icon and splash
on both platforms, not only two screens.

## Release classification

**Release blocker (rights unresolved), pending an owner decision.** It is not gated by the artwork guard, so a build ships it
today. No claim is made that using it is unlawful; the point is that there is no evidence either way, which is the standard the
project already applied to the hero art.

## Remediation options (for the owner; none performed)

1. **Obtain written rights.** From the party who can grant them for this exact file and its source (`04_official_logo.png`): a
   statement of which tool, account and terms produced the original, covering commercial store distribution, with the file hash.
   Record it in the repository and add the emblem to `art-manifest.json` as `approved` with that reference.
2. **Commission a human-made logo.** A designer delivers a vector master under a written assignment or work-for-hire agreement
   (Emergent's own README already says to request a vector master). The emblem, icons and splash are then regenerated from it.
   Likely the cleanest long-term answer and it also fixes the "regenerate from a vector master" note.
3. **Interim without the emblem.** Ship the wordmark and solid Midnight Teal only on splash/onboarding, and neutral launcher
   icons, until option 1 or 2 completes. This changes the app's look and store icons and needs the owner's approval; I have not
   done it and would not draw a substitute emblem myself.
4. **Accept the risk explicitly.** The owner records a decision to ship, with the reasoning, as an acknowledged exception.
   Not a rights finding.

## Smaller follow-ups

- Add the emblem and the website logo and favicon to the art manifest with a status and a reference, so every shipped brand
  image is classified by the guard's unit test.
- Decide whether the guard should also pin the emblem's hash, so a replaced file is noticed.
