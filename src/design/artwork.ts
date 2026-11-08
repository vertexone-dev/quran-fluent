// QR-INT-006: single source of truth for homepage/banner artwork.
//
// RIGHTS NOTICE: the "emergent" set is AI-generated artwork from the Emergent
// design project. It is BLOCKED FROM PRODUCTION until commercial-use rights are
// confirmed in writing (docs/QR-INT-005-HERO-ASSET-LICENSING.md). To release
// without it, set ACTIVE_ART to "licensed" (the already-shipped archway photo).
// No component references these file paths directly.

export type ArtSet = "emergent" | "licensed";

type HeroArt = {
  desktop: string;
  mobile: string;
  cleared: boolean;
};

const ART: Record<ArtSet, HeroArt> = {
  emergent: {
    desktop: "/quranroots-hero-cinematic-desktop.jpg",
    mobile: "/quranroots-hero-cinematic-mobile.jpg",
    cleared: false,
  },
  licensed: {
    desktop: "/quranroots-hero-premium-1122w.webp",
    mobile: "/quranroots-hero-premium-768w.webp",
    cleared: true,
  },
};

export const ACTIVE_ART: ArtSet = "emergent";

export const heroArt: HeroArt = ART[ACTIVE_ART];

/** Guided Learning Journeys arch artwork (Emergent set, same rights block).
 * With the "licensed" set the section renders without an image. */
export const journeysArt: string | null =
  ACTIVE_ART === "emergent" ? "/quranroots-journeys-cinematic.jpg" : null;
