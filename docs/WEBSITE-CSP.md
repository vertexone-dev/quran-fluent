# Website Content-Security-Policy

Status: implemented on local branch `feat/qr-web-csp`. **Not deployed, not pushed.** Deploying it is a
production change that needs the owner's approval (see "Rollout").

The policy is built per request in `src/lib/csp.ts` and applied in the Worker's single response funnel
(`src/server.ts`), next to the four existing security headers. It is not in `public/_headers`: the policy
carries a per-request nonce, and `_headers` only applies to static assets, never to SSR responses.

## The policy

```
default-src 'none';
script-src 'self' 'nonce-<per request>';
style-src-elem 'self' https://fonts.googleapis.com 'nonce-<per request>'
               'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
style-src-attr 'unsafe-inline';
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data:;
media-src 'self' https://audio.qurancdn.com https://mirrors.quranicaudio.com;
connect-src 'self' https://api.quran.com <SUPABASE_URL origin>;
manifest-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none';
base-uri 'self'; form-action 'self'; frame-ancestors 'none';
upgrade-insecure-requests            (only when the request is https)
```

No wildcards, no `'unsafe-eval'`, no `'unsafe-inline'` for scripts or `<style>` elements, no `data:` for
anything but images.

## What was audited, and why each source is there

| Area                        | Finding (from the code and the running build)                                                                                                                                                                                                                        | Policy consequence                                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Worker           | `src/server.ts` is the entry; every non-asset response (SSR, 404, 500, billing JSON) passes one funnel. Static assets are served by the assets layer and never reach it.                                                                                             | CSP is added in the funnel. HTML is always SSR, so a nonce per request is possible.                                                                                                                                                                                 |
| TanStack Start / hydration  | The SSR HTML has 4 inline scripts (theme init, a session-storage restore, two streaming/dehydration scripts) plus the module entry. TanStack supports a nonce (`router.options.ssr.nonce`) and emits `csp-nonce` meta.                                               | Nonce-based `script-src`. The Worker scopes a fresh nonce with `AsyncLocalStorage` (`src/lib/request-nonce.server.ts`); `getRouter` reads it. A client-supplied nonce is never used. All 5 scripts carry it (tested).                                               |
| Theme script                | `THEME_INIT_SCRIPT` is a blocking inline script that must run before paint.                                                                                                                                                                                          | Gets the request nonce.                                                                                                                                                                                                                                             |
| Inline styles               | 67 `style="..."` attributes in SSR output (React inline styles, Radix/Sonner positioning).                                                                                                                                                                           | `style-src-attr 'unsafe-inline'`. **Accepted residual**: a style attribute cannot execute script. Removing it would mean rewriting every inline style.                                                                                                              |
| Sonner (toasts)             | Injects one `<style>` at import, empty first and filled after, with no nonce option.                                                                                                                                                                                 | Allowed by exact hash of its stylesheet, plus the empty-string hash (permits no CSS). A unit test recomputes the hash from the installed sonner, so **upgrading sonner fails a test until the hash is reviewed**.                                                   |
| Fonts                       | `fonts.googleapis.com` stylesheet and `fonts.gstatic.com` files (Cormorant Garamond, Nunito Sans, Tajawal, Amiri, Amiri Quran). `preconnect` links need no directive.                                                                                                | `style-src-elem` + `font-src` for those two hosts.                                                                                                                                                                                                                  |
| Images                      | Only same-origin images and the CSS noise `data:` SVG. No avatars or remote images.                                                                                                                                                                                  | `img-src 'self' data:`.                                                                                                                                                                                                                                             |
| Quran audio                 | `src/lib/audio.ts` fetches `api.quran.com/api/v4/recitations/{id}/by_ayah/..` and plays the returned file. Verified against the live API: Alafasy and AbdulBaset resolve to `audio.qurancdn.com`; **Husary resolves to `//mirrors.quranicaudio.com`**. No redirects. | `connect-src` api.quran.com; `media-src` both audio hosts. All three were loaded in a real browser under the policy; a foreign host was blocked. If the API ever returns another host, playback **fails closed** (the player's existing error state), not silently. |
| Supabase                    | Browser client uses `VITE_SUPABASE_URL` (build time); the Worker has `SUPABASE_URL` (runtime). No Realtime channels, no storage URLs.                                                                                                                                | Both origins (deduplicated) go in `connect-src`. No `wss:`.                                                                                                                                                                                                         |
| Authentication              | Email/password via the Supabase client (fetch). No OAuth redirect, no third-party scripts.                                                                                                                                                                           | Nothing extra.                                                                                                                                                                                                                                                      |
| Stripe                      | Checkout and portal are full-page navigations (`window.location.href = body.url`) to a URL the server returns; no Stripe.js, no iframes.                                                                                                                             | CSP does not restrict navigations. `form-action 'self'`, `frame-src 'none'`.                                                                                                                                                                                        |
| External connections (grep) | Only the hosts above appear in `src/`.                                                                                                                                                                                                                               | Nothing else is allowed.                                                                                                                                                                                                                                            |

## Evidence

- `src/lib/csp.test.ts` (16) and `src/server.test.ts`: directive-by-directive assertions, nonce shape, malformed Supabase URL, the Sonner hash recomputed from `node_modules`.
- `tests/e2e/77-website-csp.spec.ts` (14, registered in the `public` project): header and nonce on every route, nonce on every inline script, a fresh nonce per request, a client-sent nonce ignored, **no violation** on 7 routes and Arabic, and **blocking** of an injected inline script, an `onerror` handler, a foreign script, a foreign `fetch`, image, iframe and audio.
- Mutation check: weakening `script-src` to `'unsafe-inline' 'unsafe-eval'` makes 3 unit tests and 2 e2e tests fail.
- A browser sweep of 11 routes in English and Arabic against the **built Worker under `wrangler dev`** (the real workerd runtime) and against the dev server: 0 violations, dark theme applied, toasts styled.
- `eval` and `new Function` are blocked (checked from a nonced script in a real response).

## Not verified

- **Production.** Nothing was deployed. Cloudflare can inject its own scripts in production (Web Analytics beacon, Rocket Loader, email obfuscation). They would be blocked and show up as violations. Check the dashboard settings before enforcing.
- The real Supabase project origin: the policy reads it from the Worker's `SUPABASE_URL`; tests used a local origin.
- Stripe Checkout end to end (needs live keys and the checkout flag).
- Browsers other than Chromium.

## Rollout and rollback

1. Deploy with `CSP_REPORT_ONLY=true` (a Worker variable). The header becomes `Content-Security-Policy-Report-Only`: violations are logged in the browser console but nothing is blocked.
2. Browse the real site (all three reciters, sign-in, billing page, Arabic), look for violations, fix, then remove the variable to enforce.
3. Rollback: set `CSP_REPORT_ONLY=true` again (no redeploy of code), or revert the commit.

## Related items still open

- The framework mounts `/_serverFn/` although the site defines no server functions; see the QR-SECURITY-003 report.
- Mobile has its own CSP (`mobile/csp.ts`); this document is the website only.
