// Single source of truth for brand and banner artwork (mirrors the web
// app's src/design/artwork.ts).
//
// RIGHTS NOTICE: the "emergent" artwork set is the AI-generated Design Lock
// v1.0 artwork. On the website it is BLOCKED FROM PRODUCTION until
// commercial-use rights are confirmed in writing. The same rule applies to
// every store build of this app, and it fails closed:
//
//   - A normal `vite build` (mode "production") resolves to "none": no screen
//     references the artwork, and scripts/release-art-guard.mjs (run by
//     `npm run build`) removes public/art from the output and fails the build
//     if any artwork file or reference is still present.
//   - The artwork is only enabled for the dev server (mode "development") and
//     for an explicit internal review build (`npm run build:review`, mode
//     "art-review"), which is stamped NOT FOR RELEASE and rejected by
//     `npm run release:check`.
//
// To enable the artwork for release after written rights approval, follow
// mobile/ARTWORK-RELEASE.md. Every screen is fully readable without it: the
// artwork only ever sits behind a solid midnight scrim.

export type ArtSet = "emergent" | "none";

/** True only for the dev server and the internal "art-review" build mode.
 * Plain literal comparisons on purpose: Vite replaces import.meta.env.MODE at
 * build time, so in a production build this folds to `false` and the artwork
 * paths below are dropped from the bundle entirely. */
const SHOW_UNAPPROVED_ART =
  import.meta.env.MODE === "development" || import.meta.env.MODE === "art-review";

export const ACTIVE_ART: ArtSet = SHOW_UNAPPROVED_ART ? "emergent" : "none";

const EMERGENT = {
  hero: "/art/hero-mobile.jpg",
  journeys: "/art/journeys.jpg",
  night: "/art/banner-night.jpg",
  mosque: "/art/banner-mosque.jpg",
} as const;

export type ArtKey = keyof typeof EMERGENT;

export function art(key: ArtKey): string | null {
  return SHOW_UNAPPROVED_ART ? EMERGENT[key] : null;
}

/** Design Lock v1.0 emblem (arch, mosque, open book and sprout), transparent. */
export const EMBLEM_LARGE_SRC = "/brand/quranroots-emblem.png";
