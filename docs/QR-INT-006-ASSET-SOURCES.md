# QR-INT-006 asset sources and usage terms

| Production file | Source | Original path | Notes |
|---|---|---|---|
| `public/quranroots-dashboard-banner.jpg` | Emergent `QuranRoots_Final_Delivery.zip` (package supplied by the owner) | `frontend/public/assets/art/banner-night.jpg` (1264x848, byte-identical copy; sha256 prefix `56e590bd1c9ead38`) | AI-generated ("Gemini image model", per the package's `frontend/src/quranroots/README.md`), style-referenced to Design Lock `02_website_complete_design.png`. |

## Usage terms
- Owner instruction (QR-INT-006): the Emergent Final Delivery package is the approved visual reference, its supplied artwork may be reused, and no replacement artwork is to be purchased or regenerated.
- The package contains **no licence file or terms record**; it states only "confirm your licence terms for AI imagery before commercial use".
- The commercial-rights questions recorded in `docs/QR-INT-005-HERO-ASSET-LICENSING.md` (on the QR-INT-005 branch / PR #63) apply equally here and remain **open**: the owner has approved reuse, but written confirmation from Emergent has not been recorded. This file is therefore flagged as owner-approved, rights-unconfirmed.
- Swapping this one image requires changing only the `url(...)` in the `dash-banner` utility in `src/styles.css`.
