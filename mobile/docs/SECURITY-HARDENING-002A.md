# Mobile security hardening (QR-RELEASE-002A)

Written for the project owner and the security reviewer. Local branch only; nothing pushed.

## Content Security Policy

`mobile/csp.ts` is injected into the **built** `index.html` by a Vite plugin (the dev server is unchanged because hot reload needs inline scripts).

`default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'`

| Need                       | Directive              | Finding                                                                                                                                                      |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One module script          | `script-src 'self'`    | The build has no inline script and no `eval`/`new Function`                                                                                                  |
| sql.js WebAssembly         | `'wasm-unsafe-eval'`   | **Required**: removing it makes the app fail (mutation-checked); it does not allow `eval`                                                                    |
| Bundled stylesheet         | `style-src 'self'`     | No `<style>` elements. React `style={...}` props use the CSSOM and are not restricted, so no `'unsafe-inline'` is needed (mutation-checked)                  |
| Fonts                      | `font-src 'self'`      | All fonts are bundled, no CDN                                                                                                                                |
| Images and inline icons    | `img-src 'self' data:` | Release builds contain no unapproved artwork                                                                                                                 |
| SQLite file and WASM fetch | `connect-src 'self'`   | The only fetches are `/sql-wasm.wasm` and `/quran-content.sqlite`                                                                                            |
| Audio                      | none                   | The app has **no audio feature** (the audio bar is a disabled placeholder), so there is nothing to preserve; add `media-src 'self'` when bundled audio ships |
| External links             | none                   | The one allowlisted link (`https://tanzil.net/`) opens in the system browser, outside the WebView                                                            |

No wildcard, no `unsafe-eval`, no `unsafe-inline`, no remote host.

Tests: `playwright.csp.config.ts` + `e2e-csp/csp.spec.ts` (policy present and equal to `csp.ts`; policy rules; every tab, the reader and settings with **zero** violations and no request outside the app's origin; a control proving inline script and a remote image are blocked); the whole mobile Playwright suite against the built app (`QR_E2E_BUILT=1`); the Android smoke suite on the built APK; the iOS smoke tests.

## Android

- **Backup:** see `ANDROID-BACKUP-POLICY.md`.
- **Permissions:** the only declared permission was `INTERNET`. The app makes no network request (offline test and CSP), and the external link uses an `ACTION_VIEW` intent, so `INTERNET` was **removed**; the merged manifest now declares no permission. The smoke suite (52/52) passes, including "Tanzil link opens the system browser".
- **WebView:** no custom `WebViewClient`, no `addJavascriptInterface`, no `server.url`, no `allowNavigation`, no cleartext setting; `MainActivity` only wires the back button. The activity is exported only as the launcher; the `FileProvider` is not exported.
- **Debuggable builds** expose DevTools; release builds do not (Capacitor ties it to the debug flag). Not tested on a release build.

## iOS

- `Info.plist` has no App Transport Security exception, no usage-description keys (no camera, microphone, location, photos) and no background modes.
- The external link goes through the same allowlist and the system browser.

## Secrets and dependencies

- Secret scan of the tracked files and diffs from `main`: nothing found.
- `npm audit` for the mobile app: **0 vulnerabilities in runtime dependencies**; 6 moderate in dev tooling only (`@capacitor/cli` via `xcode` and `uuid`), not shipped.
- **Website (root package):** `npm audit --omit=dev` reports **5 critical and 6 high** advisories, including `@tanstack/react-start` (unauthenticated reflected XSS in server-function responses, GHSA-qx66-fv34-fjm8; fix available in 1.169.7), plus `vite`, `zod`, `seroval`, `js-yaml`, `fast-uri`, `source-map-js`. **Not changed here:** the website's production dependencies are outside this mobile phase and need their own tested update and approval. This is the most urgent security item found.
