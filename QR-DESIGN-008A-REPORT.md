# QR-DESIGN-008A: final visual alignment and security closure

Everything here is local except the two draft PRs in section 1. Nothing was deployed, merged or pushed beyond the
two approved branches. Production Deployment run `44967138877` is still `pending` (unapproved) and `origin/main` is
still `9f24767`.

## 1. Published (approved)

| Branch                              | Commit    | Draft PR | Base                                              |
| ----------------------------------- | --------- | -------- | ------------------------------------------------- |
| `security/qr-security-003-web-deps` | `7e63d66` | #101     | `integration/qr-web-consolidated` (#96)           |
| `docs/qr-security-003-report`       | `6aa8972` | #102     | `security/qr-release-002a-mobile-hardening` (#97) |

Verified before the push: ancestry, clean trees, owner-only author, diffs limited to the expected files, no secret
patterns. No force push; #95 to #97 and all older PRs were not touched.

## 2. Zod (local, commit `0ea9f6c` on `docs/qr-design-008a-closure`)

zod 3.25.76 retained. `docs/ZOD-ADVISORY-AND-MIGRATION.md` records the advisory, the measured vulnerable behaviour
(1,000,001 issues for a 1M array on `.max(10)`, versus 1 issue on zod 4.6.7 native), the reachability assessment
(only URL search-param schemas of enums and numbers; a 1M array for such a field gives 1 issue in 0 ms), mitigation
requirements and a native zod 4 plan. A guard test fails if a zod collection schema is added (mutation-checked).
The rejected `zod/v3` workaround is documented, not used. `npm audit` still lists zod (1 high).

## 3. Website CSP (local, commit `925cd36` on `feat/qr-web-csp`, not pushed, not deployed)

Nonce-based policy built per request in the Worker funnel. Allows only Google Fonts, `api.quran.com`,
`audio.qurancdn.com`, `mirrors.quranicaudio.com` (Husary resolves there; found by querying the live API) and the
Supabase origin. No wildcards, no `unsafe-eval`, no `unsafe-inline` for scripts or `<style>` elements. Two accepted
exceptions, both documented: `style-src-attr 'unsafe-inline'` (67 SSR style attributes) and exact hashes for
Sonner's injected stylesheet plus the empty string (a unit test recomputes Sonner's hash, so an upgrade fails until
reviewed). `CSP_REPORT_ONLY=true` gives a staged rollout. Evidence: 16 + 14 new tests (unit and Playwright), a
mutation check (3 unit and 2 e2e tests fail when `script-src` is weakened), a browser sweep of 11 routes in English and
Arabic against the built Worker under `wrangler dev` and against the dev server with 0 violations, audio from all
three hosts loaded, injected script, inline handler, foreign script, fetch, image, iframe and media blocked, `eval`
blocked. **Not verified:** production (Cloudflare-injected scripts), the real Supabase origin, Stripe checkout end to
end, non-Chromium browsers. See `docs/WEBSITE-CSP.md`. The CSP branch and the visual branch are separate and were
not combined or tested together.

## 4. Design Lock v1.0

All five originals recomputed and match `DESIGN_LOCK_MANIFEST.json`.

## 5. Visual alignment (local, `feat/qr-design-008a-visual`, commit `10a418a`; base = mobile hardening + web-deps merge `88ead09`)

Implemented, CSS only: a shared glass-card surface (fine Antique Gold edge and top highlight, as in the references'
panels) applied through the `Card` component, and the short gold rule the Understand page already used on the titles of
Reflect, Memorize, Settings, Learning plan, Bookmarks, Progress, Notes, Practice and Learn (mirrors under RTL,
centred where the title is centred). Colours stay on theme tokens.

**Not implemented, and why** (remaining differences):

- Artwork everywhere (hero landscape, lanterns, headers, launch scene, journey thumbnails): rights-blocked.
- Website Settings is still a single scrolling form; the reference has a section sidebar. Entries such as Audio,
  Notifications and Family & Children would need features that do not exist, so I did not imitate it.
- Reflect: no "Reflection Prompts" chips; Memorize: no progress ring or Revise/Test tiles; Home: no Family card, no
  notification bell. These are features, not styling, and were not faked.
- Header logo shows a dark rounded badge behind the emblem instead of the reference's transparent emblem.
- Mobile Home shows "Memorize: Not available yet" where the reference shows a working Memorize tile (honest state).
- Mobile screens were already aligned in QR-DESIGN-007; no mobile code changed here.
- Gold-filled primary buttons (reference "Get Started") were not changed; primary actions remain teal.

## 6. Asset inventory

`docs/QR-DESIGN-008A-ASSET-INVENTORY.md` (committed in the visual branch): per required original region, the source
file, approximate pixel box, placement, rights status and release eligibility, plus every image in the repository with
hash, size and status. Nothing was extracted or generated; the artwork guard stayed active ("no blocked artwork in
.output"). Finding: `mobile/public/brand/quranroots-emblem.png` ships without an `art-manifest.json` entry or rights
note (owner decision). I first wrongly claimed two mobile banners were unpinned; the mobile guard hashes all of
`public/art`, and the document is corrected.

## 7. Evidence

Side-by-side sheets (local, not committed because they embed the unlicensed originals):
`<scratchpad>/final/compare/compare-a.png` (Home), `-b` (Settings), `-c` (mobile vs iOS), `-d` (Android). Website
screenshots: `<scratchpad>/vis/after/` (60: desktop, tablet, phone, 320 px, English/French/Arabic). Exact matches:
none at pixel level, because the references are rendered AI art; structure, nav, palette, typography and card
treatment correspond. Note: the Android Quran-tab screenshot caught the list mid-transition (software GPU).

## 8. Regression results (candidate `10a418a`, disposable stack only)

| Check                                                                                     | Result                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| TypeScript (root, mobile)                                                                 | pass                                                                                             |
| ESLint (whole repo)                                                                       | 0 errors, 20 warnings, all pre-existing (none in files I changed)                                |
| Website unit                                                                              | 260 pass                                                                                         |
| Mobile unit (verified copy of the approved DB, `REQUIRE_CONTENT_DB=1`)                    | 163 of 163 pass                                                                                  |
| Full website Playwright (646)                                                             | **631 passed, 15 skipped, 0 failed** (25.0 min). The 15 skips are the production-targeted specs. |
| Full DB rebuild + both pinned fingerprints                                                | pass: content `b586ba39…`, full DB 20 tables / 27,247 rows                                       |
| Core content rebuild                                                                      | pass                                                                                             |
| Artwork guard                                                                             | pass (web and mobile build)                                                                      |
| Overflow sweep (3 widths, 3 languages, normal and large text, 15 page states)             | 0 of 270 overflow (Chromium only)                                                                |
| CSP compatibility                                                                         | on the CSP branch, section 3                                                                     |
| iOS simulator (iPhone 17 Pro): 3 XCUITests (EN, FR, AR-RTL) + AccessibilityAuditTests (5) | all pass                                                                                         |
| Android emulator-5558 smoke suite                                                         | **49 of 50 pass, 1 failure**                                                                     |

Failures and caveats, stated plainly:

- A first Playwright attempt stopped at one failure because my local `.env.test` lacked the placeholder Stripe values
  CI sets; after adding them (and the server-side Supabase variables) the full run passed. A first Android run
  failed 45 of 50 because I had not copied `sql-wasm.wasm` into `public/` as `mobile-ci.yml` does (the app showed
  "Could not load bundled sql.js WASM"); both were my harness setup, not app defects.
- The one remaining Android failure, "Practice opens from Home shortcut": the script tapped y=2254, which is under the
  bottom tab bar, and landed on the Qur'an tab. That is consistent with a harness tap on an obscured node. My manual
  re-check did not complete (the app launch landed on a Chrome first-run screen), so I have **not** confirmed the
  Practice shortcut works on a device; the code shows it exists on Home.
- Not run: iPhone SE (no such runtime installed), real devices, TalkBack, VoiceOver, WebKit/Safari desktop, the full
  Playwright suite on the CSP branch (only its own spec and sweeps), Playwright on the combined CSP + visual code.
- Android and iOS runs used one pinned device each; nothing was installed on or sent to emulators 5554/5556.

## 9. Safeguards and cleanup

- The E2E safeguard worked as designed: without `E2E_SUPABASE_WORKDIR` the setup script refused (it resolved your
  stack at 54321 while `.env.test` named my disposable one at 56321) and created nothing. I read your stack once,
  read-only, to confirm its user count stayed at 2 and contained no test user.
- Removed: disposable Supabase stack (0 containers, 0 volumes), my `.env.test`, emulator 5558, the simulator, the
  worktree symlinks, the DB and WASM copies, a `cap sync` change to `capacitor.settings.gradle`. The approved
  database still hashes to `43441fa8…` with no sidecars next to it.
- Kept for you to decide: worktrees `qr-web-csp`, `qr-008a`, `qr-visual` and their local branches.

## 10. Owner decisions

1. Review #101 and #102; push the CSP branch (and deploy with `CSP_REPORT_ONLY=true` first) when you approve.
2. Whether the website Settings gets a section sidebar built only from real sections, and whether Reflect prompts or a
   Memorize progress ring (new functionality) are wanted.
3. Rights for the artwork (see the inventory); the emblem's rights note.
4. Keep zod 3 for now, or schedule the zod 4 migration.
