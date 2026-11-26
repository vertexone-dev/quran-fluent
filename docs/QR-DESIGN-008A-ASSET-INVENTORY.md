# QR-DESIGN-008A: original artwork inventory

Nothing in this document was extracted, cropped, generated or committed. It lists what the five locked
originals contain that the application would need in order to match them pixel for pixel, where each piece
would go, and why it cannot ship. The release artwork guard stays active (`npm run build` ran it: "no blocked
artwork in .output").

## Sources (Design Lock v1.0, all five recomputed and matching `DESIGN_LOCK_MANIFEST.json`)

| File                           | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| 01_website_homepage.png        | `2d0cfe931b4a14945d2007c30e8c172309744ec664e1780fb7908865bbd6a607` |
| 02_website_complete_design.png | `f2dec3444861836bd6451611bcab579def57cff1ae73ebb442a857de0d2b9a80` |
| 03_mobile_ten_screens.png      | `b67693b5a9f95061a17eb568f4f9916f479506b5db82ef1b3d38565001350273` |
| 04_official_logo.png           | `ae6b5b4be0a02aff4af6472cee8a2f2af3f89c267c7eb5180d81905485b43ef6` |
| 05_settings_web_mobile.png     | `a2e6b3e029a7c07d453fbebfe1957d04085e3000a25db83635ee7babaa647e25` |

Pixel sizes: 01 is 1672x941; 02 to 05 are 1536x1024.

**Rights status of all five (and everything in them): unresolved.** The Design Lock README calls them "original
generated PNG files". The repository's own licensing review (`docs/QR-INT-005-HERO-ASSET-LICENSING.md`) found no
licence, terms acceptance, account/product/date record or assignment of rights for this generated art, and
concluded that commercial-use rights "cannot be established". Prompt-only AI output may also not be
copyrightable. None of it is release-eligible until the owner obtains written rights.

## What fidelity would require (approximate regions in the source pixels; not extracted)

| Item                                                                                                                    | Source | Approx. region (x, y, w x h)                        | Intended placement                 | Release eligibility                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Arched-window sunset landscape (hero scene)                                                                             | 01     | 400, 90, 1040x470                                   | Website Home hero background       | **No.** Rights unresolved. Replaced by the CSS arch/horizon-glow treatment.                                                       |
| Lantern, Qur'an on a rehal, rug (left foreground)                                                                       | 01     | 0, 90, 520x540                                      | Website Home hero, left            | **No.** Rights unresolved. Not reproduced.                                                                                        |
| Arabesque lattice and foliage frame (right)                                                                             | 01     | 1400, 90, 272x610                                   | Website Home hero, right           | **No.** Rights unresolved.                                                                                                        |
| Header emblem + wordmark                                                                                                | 01, 04 | 100, 12, 245x66                                     | Website header                     | **Shipped under owner approval** as `public/quranroots-logo.png` (see below). A written rights record for the logo was not found. |
| Hero with seated reader (a person)                                                                                      | 02     | 30, 40, 800x430                                     | Alternate Home hero                | **No.** Rights unresolved, and it depicts a person (model/likeness rights unknown).                                               |
| Understand lantern header, Learning Journeys thumbnails (3), Reflect lantern, Memorize emblem, Family and Journey tiles | 02     | assorted tiles below y=500                          | Website section headers            | **No.** Rights unresolved. Family, Kids/Teens and Duas tiles also depict features the app does not have.                          |
| Launch screen scene (mosque, path, glowing arch)                                                                        | 03     | 50, 10, 270x515                                     | Mobile launch/splash               | **No.** Rights unresolved. Mobile ships the emblem on solid Midnight Teal.                                                        |
| Onboarding, Home, Learn, Reflect, Memorize header illustrations                                                         | 03     | per phone, top 20%                                  | Mobile screen headers              | **No.** Rights unresolved. Mobile headers are CSS.                                                                                |
| Official logo scene (gold frame, foliage, sunrise)                                                                      | 04     | full 1536x1024                                      | Brand page / splash                | **No.** Rights unresolved. The emblem alone is what ships.                                                                        |
| Settings banner (arched mosque landscape, lanterns)                                                                     | 05     | 10, 190, 1050x170 (web); 1140, 120, 370x80 (mobile) | Website and mobile Settings header | **No.** Rights unresolved.                                                                                                        |

## What is in the repository today

| File                                                                               | Size      | SHA-256 (first 16) | Source                                     | Status                                                                                                                                     |
| ---------------------------------------------------------------------------------- | --------- | ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `public/quranroots-logo.png` (also `mobile/public/`)                               | 240x216   | `b72ee43bdab5d82c` | Design Lock logo, cropped                  | `approved` in `scripts/lib/art-manifest.json` ("Approved Design Lock logo")                                                                |
| `mobile/public/brand/quranroots-emblem.png`                                        | 703x483   | `582b5316fb04b4fe` | Design Lock emblem (transparent)           | Shipped. **Not listed** in the web `art-manifest.json`; classification is by the mobile guard's rules. Rights record not found.            |
| `public/favicon.png`                                                               | 64x64     | `f4ef9469e685a8d9` | brand favicon                              | `approved`                                                                                                                                 |
| `public/quranroots-hero-cinematic-desktop.jpg`                                     | 1264x848  | `26d05c8e7991dbdc` | Emergent, AI-generated                     | **blocked** (pinned)                                                                                                                       |
| `public/quranroots-hero-cinematic-mobile.jpg`, `mobile/public/art/hero-mobile.jpg` | 848x1264  | `8844047ff43a1612` | same                                       | **blocked** (pinned)                                                                                                                       |
| `public/quranroots-journeys-cinematic.jpg`, `mobile/public/art/journeys.jpg`       | 1264x848  | `e6b09b6333d30113` | same set                                   | **blocked** (pinned)                                                                                                                       |
| `public/quranroots-hero-premium-*.webp/.png` (4 files)                             | 480-1122w | see manifest       | older archway photo, provenance unverified | **blocked** (pinned)                                                                                                                       |
| `mobile/public/art/banner-mosque.jpg`                                              | 1264x848  | `ff38c87ebb8e8359` | Emergent set                               | Blocked: the mobile guard treats the whole `public/art` set as blocked and rejects identical content (SHA-256) anywhere in a build output. |
| `mobile/public/art/banner-night.jpg`                                               | 1264x848  | `56e590bd1c9ead38` | Emergent set                               | same as above                                                                                                                              |
| Fonts (Amiri, Open Sans, Playfair, Cormorant, Nunito, Tajawal)                     |           |                    | Google Fonts (OFL)                         | licensed; see `mobile/public/fonts/LICENSES.md`                                                                                            |
| Icons                                                                              |           |                    | lucide-react (ISC)                         | licensed                                                                                                                                   |

## Gap found while compiling this inventory

`mobile/public/brand/quranroots-emblem.png` ships in the mobile app but has no entry in
`scripts/lib/art-manifest.json` and no rights note. It is described in code as the Design Lock v1.0 emblem. It is
the same family of artwork as the approved logo, so it was left as is; listed for an owner decision.

(An earlier draft of this document claimed two mobile banners were not hash-pinned. That was wrong: the mobile
guard derives its blocked hashes from every file in `mobile/public/art`. Corrected after reading the guard.)

## What would unblock fidelity

Any one of the options already recorded in `docs/QR-INT-005-HERO-ASSET-LICENSING.md`: a written commercial grant
covering the exact files; commissioned or stock-licensed photography; or regeneration under an owner-controlled
account whose terms are archived at generation time. Until then the CSS treatment (palette, arch, horizon glow,
lattice) is the release design, and the visual comparison reports artwork as "rights-blocked", not as a defect.
