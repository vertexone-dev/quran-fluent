/**
 * Content-Security-Policy for the bundled mobile app (QR-RELEASE-002A).
 *
 * The app loads only its own files: one module script, one stylesheet, bundled fonts,
 * a bundled SQLite file and sql.js's WebAssembly, all fetched from its own origin
 * (https://localhost on Android, capacitor://localhost on iOS). It makes no network
 * request of its own. The one external link opens in the system browser, outside the
 * WebView, so it needs no entry here.
 *
 * Directives and why:
 *  - default-src 'none'          nothing is allowed unless listed below.
 *  - script-src 'self' 'wasm-unsafe-eval'
 *                                the bundle, and compiling sql.js's WebAssembly. No inline
 *                                script, no eval, no remote script.
 *  - style-src 'self'            the bundled stylesheet only.
 *                                No 'unsafe-inline' anywhere: React sets `style={...}` through
 *                                the CSSOM, which a policy does not restrict. (Found by
 *                                mutation: removing an earlier style-src-attr relaxation
 *                                changed nothing across every screen.)
 *  - font-src 'self'             bundled fonts (no CDN).
 *  - img-src 'self' data:        bundled images and inline SVG/data icons.
 *  - connect-src 'self'          fetch() of the SQLite file and the WASM module.
 *  - base-uri / form-action 'none', object-src 'none'.
 * There is no media-src: the app has no audio today. Add `media-src 'self'` in the same
 * change that ships bundled audio.
 * frame-ancestors cannot be set from a meta element and is not needed for a WebView.
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");
