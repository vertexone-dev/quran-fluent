# Mobile artwork: release policy

**Status: the cinematic artwork is BLOCKED from production and store builds.**

The Design Lock v1.0 artwork in `public/art/` (`hero-mobile.jpg`, `journeys.jpg`,
`banner-night.jpg`, `banner-mosque.jpg`) is AI-generated. Having the files in the
repository, or in the Emergent handoff, is **not** evidence that we may use them
commercially. Until written commercial-use rights are on file, they may only be seen
in development and internal review.

The website applies the same rule. Its evidence review lives in
`docs/QR-INT-005-HERO-ASSET-LICENSING.md` on the QR-INT-005 branch (PR #63); that file
is not on `main` yet, so this document is self-contained and does not depend on it.

## What is and is not gated

| Item                                                                                                 | Status                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `public/art/*.jpg` (Home hero, Learn journeys banner, Planned banners)                               | **Blocked** until written rights are approved                     |
| `public/quranroots-logo.png`, `public/brand/quranroots-emblem.png`, native launcher icons and splash | The approved Design Lock logo and emblem, not gated by this guard |
| Bundled fonts (`public/fonts/`)                                                                      | SIL OFL 1.1, see `public/fonts/LICENSES.md`                       |

Every screen is fully readable without the artwork: it only ever sits behind a solid
midnight scrim, and the screens fall back to the plain Midnight Teal surface.

## How the safeguard fails closed

1. **Build mode decides.** `src/artwork.ts` shows the artwork only when the Vite mode is
   `development` (dev server) or `art-review`. A normal `vite build` runs in mode
   `production`, resolves to no artwork, and the artwork paths are folded out of the bundle.
2. **`npm run build` runs the guard.** `scripts/release-art-guard.mjs --prune dist` deletes
   the copied `dist/art/` directory (Vite copies `public/` wholesale), then fails the build
   if anything unapproved remains. It checks, in every file under `dist/`:
   - any path inside an `art/` directory,
   - any file name that matches a source artwork file,
   - any file whose SHA-256 equals a source artwork file (catches renamed copies),
   - any text file (JS, CSS, HTML, JSON, source maps) that references an artwork path or name,
   - the review-build stamp (below).
3. **`npm run release:check`** runs the same checks, without modifying anything, on `dist/`
   and on the Capacitor copies (`android/app/src/main/assets/public`,
   `ios/App/App/public`) when they exist. **Run it after `npx cap sync` and before
   building any APK/AAB/IPA.** `cap sync` copies `dist/` into the native projects, so a
   stale review build there would otherwise ship.
4. **Review builds are stamped.** `npm run build:review` builds with the artwork and writes
   `REVIEW-BUILD-NOT-FOR-RELEASE.txt` into `dist/`. The guard rejects that stamp in every
   release check, so a review build cannot pass `release:check`.
5. **Tests.** `scripts/release-art-guard.test.ts` covers each failure above and the default
   `ACTIVE_ART === "none"`; `npm run test` runs it.

The guard reads the blocked set from `public/art/`, so a new image added there is blocked
automatically. Never remove or rename files in `public/art/` to make a release pass.

## Release steps (artwork stays blocked)

```
cd mobile
npm run build            # guard prunes and verifies
npx cap sync
npm run release:check    # dist + android + ios copies must all pass
```

## Enabling the artwork after written rights approval

Do not do this on your own judgment. It needs, in the repository, before the change:

1. A written commercial-use statement from the artwork's creator or rights holder
   (Emergent), covering the exact files, store distribution, and AI-generated content.
   Record it in `docs/` with the file hashes it covers.
2. Owner sign-off on that record.

Then, in one reviewed PR:

1. Change `src/artwork.ts` so a production build may show the cleared set (for example, add
   `"production"` to the allowed modes, or introduce a per-set `cleared` flag as the website
   does). Keep the default for any uncleared set at "none".
2. Update `scripts/release-art-guard.mjs` so it blocks only files **not** listed in the
   rights record (compare by SHA-256), instead of everything in `public/art/`.
3. Update `release-art-guard.test.ts` to match, keeping the failing cases for any file that is
   not in the record.
4. Run `npm run build`, `npm run release:check` and the full test suite.

Until all of that exists, a store build must ship without the artwork.
