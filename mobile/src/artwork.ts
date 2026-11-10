// Single source of truth for brand and banner artwork (mirrors the web
// app's src/design/artwork.ts).
//
// RIGHTS NOTICE: the "emergent" artwork set is the AI-generated Design Lock
// v1.0 artwork. On the website it is BLOCKED FROM PRODUCTION until
// commercial-use rights are confirmed in writing
// (docs/QR-INT-005-HERO-ASSET-LICENSING.md). The same rule applies to any
// store build of this app: set ACTIVE_ART to "none" to ship without it --
// every screen stays fully readable because the artwork only sits behind a
// solid midnight scrim.

export type ArtSet = "emergent" | "none";

export const ACTIVE_ART: ArtSet = "emergent";

const EMERGENT = {
  hero: "/art/hero-mobile.jpg",
  journeys: "/art/journeys.jpg",
  night: "/art/banner-night.jpg",
  mosque: "/art/banner-mosque.jpg",
} as const;

export type ArtKey = keyof typeof EMERGENT;

export function art(key: ArtKey): string | null {
  return ACTIVE_ART === "emergent" ? EMERGENT[key] : null;
}

/** Design Lock v1.0 emblem (arch, mosque, open book and sprout), transparent. */
export const EMBLEM_LARGE_SRC = "/brand/quranroots-emblem.png";
