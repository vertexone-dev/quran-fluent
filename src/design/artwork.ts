// QR-WEB-006: single source of truth for homepage/banner artwork. Fails closed.
//
// RIGHTS NOTICE: the "cinematic" set (Emergent's AI-generated Design Lock v1.0
// art) is BLOCKED FROM PRODUCTION until commercial-use rights are confirmed in
// writing (docs/QR-INT-005-HERO-ASSET-LICENSING.md). It is shown ONLY:
//
//   - on the dev server (Vite mode "development"), and
//   - in an explicit internal review build (Vite mode "art-review",
//     `npm run build:review`), which is stamped NOT FOR RELEASE and rejected
//     by `npm run release:check`.
//
// Every other build -- including `npm run build`, which CI and the production
// deploy both run -- resolves to the CSS-only treatment (CssArtBackdrop): the
// approved palette drawn with gradients and shapes, no image at all. The
// cinematic paths below are then folded out of the bundle at build time, and
// scripts/release-art-guard.mjs fails the build if any of it remains.
//
// Enabling the cinematic art for release needs written rights first; see
// docs/ARTWORK-RELEASE.md. No component references an image path directly.

export type ArtMode = "css" | "cinematic";

// Plain literal comparisons on purpose: Vite replaces import.meta.env.* at
// build time, so in a production build these fold to `false`.
const REVIEW_BUILD =
  import.meta.env.MODE === "development" || import.meta.env.MODE === "art-review";

// Dev-server only (DEV is false in every build): lets the e2e suite exercise
// the CSS-only treatment (playwright project "css-art") without a production
// build. It can never turn artwork ON, and it does nothing in a release build.
const FORCE_CSS_IN_DEV = import.meta.env.DEV && import.meta.env.VITE_ART_MODE === "css";

const SHOW_CINEMATIC = REVIEW_BUILD && !FORCE_CSS_IN_DEV;

export const ART_MODE: ArtMode = SHOW_CINEMATIC ? "cinematic" : "css";

type HeroArt = { desktop: string; mobile: string };

/** Homepage and auth backdrop photo set; `null` means use <CssArtBackdrop />. */
export const heroArt: HeroArt | null = SHOW_CINEMATIC
  ? {
      desktop: "/quranroots-hero-cinematic-desktop.jpg",
      mobile: "/quranroots-hero-cinematic-mobile.jpg",
    }
  : null;

/** Guided Learning Journeys arch artwork; `null` means use <CssArtBackdrop />. */
export const journeysArt: string | null = SHOW_CINEMATIC
  ? "/quranroots-journeys-cinematic.jpg"
  : null;
