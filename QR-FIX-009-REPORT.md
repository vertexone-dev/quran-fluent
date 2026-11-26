# QR-FIX-009: targeted release-blocking corrections

Branch `fix/qr-fix-009`, local only, from `feat/qr-design-008b` @ `8cd0d79`. Final code commit `12f64ba`. Nothing was pushed, merged,
deployed or changed outside the repository. Production Deployment run `44967138877` is untouched. No artwork, logo, billing, live
configuration, production data, Quran text, translation or source status was changed.

Commits on top of `8cd0d79`: `44bbcc2` (headline fix, Android Practice step), `0ca08d5` (WebKit logout tests), `3f13043` (cold-server timeout),
`9ff8686` (sidebar highlight, null audio sink), `4b2a073` (onboarding title, screenshots), `12f64ba` (final width caps), plus this report.

## 1. iPhone SE French headline

**Reproduced** on the iPhone SE simulator at the largest text size: "Remonte / z à la langue." Also reproduced in Chromium by setting the app's
own system-text-scale variable (3.1x) at 375 px: 5 of 27 test combinations failed, so the defect was **wider than French on one phone**: French at
320, 375 and 390 px, English at 320 px and Arabic at 320 px.

**Root cause.** The Home headline (`.tagline`) is sized in `rem`, so it grows with the system text size. At the largest sizes on a narrow phone its
longest word ("Remontez", "Découvrez") is wider than the screen. Since QR-DESIGN-007C a global `overflow-wrap: anywhere` then splits any word that
does not fit, anywhere.

**Fix** (`mobile/src/styles.css`): cap the size relative to the width, `font-size: min(1.75rem, 18vw)`. At normal sizes `1.75rem` is the smaller
value, so nothing changes; at the largest sizes the word fits and the headline stays several times the body size. `vw` rather than a container query
because the app's iOS target is 14, which has no container query units. The cap was first 15vw; that fixed the splitting but made the onboarding
title smaller than the body text, so I raised it to the largest value at which the words still fit (a regression of large-text hierarchy I introduced
and then corrected).

**A second instance found by looking at screenshots.** My first SE "default size" run failed because the simulator was still at the largest size from
my earlier check (my script error), and the screenshot showed the onboarding title "QuranRoots" breaking as "QuranRo / ots": the same cause. Same fix,
`min(1.9rem, 16vw)` (and the short-screen variant).

**Tests.** 45 new Chromium tests (`headline-wrap.spec.ts`, `onboarding-title-wrap.spec.ts`: English, French and Arabic, 320/375/390 px, 1x/2x/3.1x,
measuring whether any word spans two lines, and no sideways overflow). They fail without the fix (5 headline, 6 onboarding) and pass with it.
Confirmed on real WebKit: iPhone SE at the largest text size, French Home and the onboarding screen render whole words.
Before and after: `docs/qr-fix-009/ios-se-largest-text-fr-home-BEFORE.png` / `-AFTER.png`, `ios-se-largest-text-onboarding-BEFORE.png` / `-AFTER.png`,
`ios-se-largest-text-en-home-AFTER.png`.

**Not damaged:** English, Arabic and RTL layouts pass the new tests and the iOS Arabic RTL test; responsive and large-text tests pass (section 6).
**Limit:** other headings (`h1` to `h3`) still carry `overflow-wrap: anywhere` and could split a word wider than the screen at the largest size; I
fixed the two found, not every heading.

## 2. Android Practice smoke step

**Verdict: the test script, not the app, not the scrolling itself.** Evidence:

- The Practice shortcut works: after scrolling Home, a physical tap on it opens the Practice screen ("Review exercises from your lessons")
  (`android-practice-opened-AFTER.png`). Home is a normal scrolling page; at first view the Shortcuts row is below the fold, faintly visible behind the
  floating tab bar (`android-home-first-view-practice-behind-tab-bar-BEFORE.png`).
- Once Home had been scrolled, UI Automator reported every node in the WebView shifted up by about 590 px, **including the fixed tab bar and the
  WebView's own bounds** (Practice at y 991 to 1183 when it really sits at about 1582 to 1773). That is the offset quirk the suite's own comments
  describe. The script tapped the reported centre and hit the Home reading card, which opened the Surah list.
- My first attempted fix (swipe, wait, re-dump) failed the same way, and a naive swipe-and-tap version broke 8 later steps, which is how I confirmed
  the cause was the reported coordinates and not timing.

**Fix** (`mobile/e2e/android-smoke/run.sh`): like `font-scale.sh`, take the tap position from the page's own layout over DevTools (scroll the Practice
button to the middle, read its rect, add the WebView's top edge), addressing the app by its own process id, then return Home to the top so later
bounds-based taps are not shifted. Result: smoke suite **50 of 50** (was 49 of 50).

## 3. The two WebKit logout failures

Reproduced against the #101 baseline build and the current build, 5 runs each: both tests failed **5 of 5 on both** (so not a regression from 008B).

**Root cause (tests, not the app).** Probes showed that right after login WebKit logs "Importing a module script failed" and the page then reloads
`/dashboard`, interrupting the test's next `goto("/quran")` ("Navigation ... is interrupted by another navigation to /dashboard"). The reload comes
from TanStack Router's `lazyRouteComponent`: when a lazy route chunk import fails with a "module not found" style error it reloads the page once (meant
for stale deployments). WebKit reports an import **cancelled by a navigation** with that same message; Chromium does not. The test navigated while the
dashboard chunks were still loading. The logout test then clicked on a page that had just been reloaded.
**Fix** (`auth.spec.ts`): wait for the post-login route to finish loading before navigating. Both tests then pass 3 of 3 on the baseline and the
current build. **App note, not changed:** a Safari user who navigates away very quickly while a route chunk loads could see the page reload once
(the library's guard allows one reload per message per session); it is the router's intended behaviour.

## 4. Zod guard

Run from the docs branch against this code: **2 of 2 pass**; adding a `z.array(...)` file makes it fail (mutation check). Zod is still **3.25.76**
(`package.json` and the lockfile are unchanged), and `npm audit --omit=dev` still lists only `zod`. No upgrade, and the rejected `zod/v3` route is not used.

## 5. PR #104 Mobile CI

All jobs pass: classify changes, mobile content checks status, mobile static checks, quran content integrity, **full Quran database rebuilt from
repository sources** (8m25s), and the **mobile release gate**. One job, "mobile content checks (approved Quran database)", is _skipped_ by design
(the approved-database job runs only for PRs into `main`; #104's base is #97's branch). The `test` workflow also does not run on this base. No outstanding
failures. (CI was checked once at the start of this phase and again after it completed.)

## 6. Regression on the final candidate

| Check                                                                                             | Result                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript (root, mobile)                                                                         | pass                                                                                                                                                                                                                                   |
| ESLint, all tracked files                                                                         | 0 errors, 20 warnings (pre-existing)                                                                                                                                                                                                   |
| Website unit                                                                                      | 301 pass                                                                                                                                                                                                                               |
| Mobile unit (verified copy of the approved DB, `REQUIRE_CONTENT_DB=1`)                            | 163 of 163                                                                                                                                                                                                                             |
| Website Playwright, Chromium, full (680 tests, commit `9ff8686`)                                  | **662 passed, 3 failed, 15 skipped** (skips = production-targeted specs). The 3 failures (a CSS-art test and two lesson/DB tests, each a timeout under machine load) **pass when their spec files are re-run alone: 42 of 42**         |
| WebKit, signed-out (150, built Worker)                                                            | 148 passed, 2 failed (a Reader test and a redirect test, 33 s timeouts); both pass 3 of 3 on re-run. The two logout tests from 008B now pass                                                                                           |
| WebKit, signed-in subset (34)                                                                     | 33 passed, 1 failed (Memorize ring, 33 s timeout); passes 3 of 3 on re-run                                                                                                                                                             |
| Mobile Playwright (270, includes the 45 new tests) and mobile CSP spec (4)                        | all pass                                                                                                                                                                                                                               |
| CSP functionality and security (spec 77, Chromium and WebKit)                                     | pass                                                                                                                                                                                                                                   |
| Full DB rebuild, content fingerprint `b586ba39…1225b1`, full fingerprint (20 tables, 27,247 rows) | pass                                                                                                                                                                                                                                   |
| Approved database file hash                                                                       | `43441fa8b2c3f225…` unchanged; no sidecars; only copied, never opened in place                                                                                                                                                         |
| Artwork guard (web and mobile builds)                                                             | pass                                                                                                                                                                                                                                   |
| Android emulator (5558): smoke / font scale 1.0 to 2.0                                            | **50 of 50** / **24 of 24**                                                                                                                                                                                                            |
| iOS iPhone SE (3rd gen): default text / largest accessibility text                                | **3 of 3** / **3 of 3**                                                                                                                                                                                                                |
| iOS iPhone 17 Pro: 3 UI tests + accessibility audit                                               | all pass                                                                                                                                                                                                                               |
| E2E Supabase isolation safeguard                                                                  | the setup script was run only with an explicit disposable workdir (created and "already exists" paths). I did **not** re-demonstrate the mismatch refusal this phase, because that would have run `supabase status` against your stack |

Web code changed in this phase only in `SettingsNav.tsx` (below); the later commits (`4b2a073`, `12f64ba`) touch only `mobile/` and docs, so the full web
run on `9ff8686` covers the final web code.

**Corrections found by the regression work** (all fixed, all in my own earlier work or the harness):

- **Settings sidebar (a real defect in my 008B feature):** clicking an entry near the bottom of the page marked it current, then the scroll-spy's
  bottom-of-page rule overrode it (clicking "Display preferences" highlighted "Account"). A click now holds for 1.5 s. The keyboard test that
  caught it failed before the fix and passes after (12 of 12).
- **Audio specs 45 and 47 (7 tests) failed deterministically, including on the #101 baseline.** Headless Chromium on this Mac could not play even a
  0.3 s clip to the end (the clock froze at 0.06 s). Chromium now runs with `--disable-audio-output` (a null audio sink), which the audio specs
  do not need; all 25 pass. Sound is not under test.
- **Spec 53** failed deterministically because a freshly started dev server needs about 10 s to compile `/dashboard` on first visit and the
  test waited 5 s; the assertion is unchanged, its timeout is now sized for a cold server.

## 7. Incidents and limits

- **The machine was overloaded for most of this phase** (load average above 300; Docker's VM and iCloud sync were busy; a 4-day-old emulator that is
  not mine used about 280% CPU). Part of that was mine: I left an Android emulator and a simulator running during a long website run. The first
  full website run took 1.6 hours with 45 failures; I stopped, ran one heavy job at a time, and re-ran. Results above are from those runs.
- **Your emulators.** At the end `adb devices` showed no emulators other than mine, and the crash log my emulator printed referenced an `qf_test`
  crash. I did not touch the Pixel_9 or qf_test emulators; I cannot say when or why they stopped.
- **I looked at Docker container CPU for all containers once** (`docker stats`, including yours) while diagnosing the overload. I read no data from any
  Supabase stack of yours.
- Another self-matching wait in a script of mine cost time again; I switched to checking output files.
- **Cleanup error in 008B, still open:** the other worktrees (`qr-008a`, `qr-008b`, `qr-visual`, `qr-web-csp`, `qr-integ-web`) have no `node_modules`.
  This worktree (`qr-fix009`) has its own; I removed the temporary baseline worktree.

## 8. Unresolved blockers

1. Other headings (`h1` to `h3`) still use `overflow-wrap: anywhere`; a long word could still split at the largest sizes on a narrow phone.
2. The mobile Android smoke script depends on DevTools coordinates for Practice; other bounds-based taps remain subject to the offset quirk.
3. Machine-load sensitivity: three website tests, three WebKit tests and the cold-start tests only pass reliably on a quiet machine.
4. Release blockers from 008B are unchanged: emblem rights, unreviewed Reflect prompts and FR/AR labels, hero artwork rights, CSP rollout decision.
5. `feat/qr-design-008b` (#104) does not contain these fixes; they exist only on this local branch until you approve a push.
