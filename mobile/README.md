# QuranRoots Mobile (`mobile/`)

Offline-first Capacitor client (Android and iOS) for QuranRoots. It is a
separate project from the web app in the repository root.

> **Status:** this README is orientation only. Commands listed here are
> **not executed** as part of writing it. Facts are labeled
> **OBSERVED** (read from files in this repo) or **ASSUMPTION** (unverified).
> The full baseline, verification procedure, and evidence template live in
> [`docs/MOBILE-BASELINE.md`](../docs/MOBILE-BASELINE.md). Read that before
> relying on anything here.

## What is here

| Path | What it is | Basis |
| --- | --- | --- |
| `src/` | React 19 + TypeScript app (screens, `db.ts`, `local-store.ts`, `i18n.ts`) | OBSERVED |
| `public/` | Static assets, fonts; generated data files land here (gitignored) | OBSERVED |
| `scripts/export-content-db.mjs` | Builds the bundled SQLite content file | OBSERVED |
| `capacitor.config.ts` | `appId com.quranroots.app`, `webDir dist` | OBSERVED |
| `android/` | Gradle project (`minSdk 24`, `compileSdk/targetSdk 36`) | OBSERVED |
| `ios/` | Xcode project with a Swift Package (`CapApp-SPM`), deployment target 15.0 | OBSERVED |
| `e2e/*.spec.ts` | Playwright specs, desktop Chromium 390x844 | OBSERVED |
| `e2e/android-smoke/` | `adb` + UI Automator on-device smoke suite | OBSERVED |

## How it fits together

1. The content database `quran-content.sqlite` must be present in `public/`
   (and `content-db/` for the smoke suite). **Preferred source:** an existing
   owner-supplied SQLite artifact with verified provenance and a matching hash.
   **Fallback only:** `export-content-db.mjs` (reads production; see the
   approval-only section below). OBSERVED from script comments; neither path
   has been run here.
2. `vite build` produces a static SPA in `dist/` (OBSERVED config).
3. `cap sync` copies `dist/` into the native projects (OBSERVED from the
   `.gitignore` comments; the actual command has not been run here).
4. At runtime the app loads `sql.js` WASM and the SQLite file from local assets
   and reads content with no network calls (OBSERVED in `src/db.ts` comments;
   the "no network" claim is **unverified**).

## Things to know before you touch it

- **Production read.** The export script reads production Supabase with the
  publishable key from the repo-root `.env`. Prefer an existing owner-supplied
  SQLite artifact with verified provenance and a matching hash. A fresh export
  is a fallback and needs separate explicit owner approval. Never print or
  commit `.env`.
- **Generated, gitignored:** `node_modules/`, `dist/`, `content-db/`,
  `public/quran-content.sqlite`, `public/sql-wasm.wasm`, native `public/`
  asset folders, Gradle and Xcode build output. A fresh checkout has none of
  them (OBSERVED: `node_modules`, `dist`, `content-db` are absent now).
- **Bundle ID mismatch (OBSERVED):** Android and Capacitor use
  `com.quranroots.app`; the iOS project uses
  `com.quranroots.mobilefeasibility`. Unresolved; do not "fix" it inside
  unrelated work.
- **No mobile CI found (OBSERVED, initial inspection):** no GitHub workflow
  under `.github/workflows/` references `mobile`. This is not an exhaustive
  audit; other CI coverage is not ruled out.
- **Not production-wired (OBSERVED):** `package.json` states the app is not
  part of any production build or deploy pipeline.
- **Evidence hygiene:** Playwright (desktop browser) results are not evidence
  of on-device behavior. Record them separately.

## Verification steps (all NOT RUN; proposed)

**Do not copy-paste these as a script.** Several steps download software,
change device state, or (fallback only) read production, and each needs its
own explicit owner approval. They are deliberately a table, not a shell block.
Run steps one at a time, in the order and from the directories given in
[`docs/MOBILE-BASELINE.md`](../docs/MOBILE-BASELINE.md) section 4, which holds
the authoritative commands, expected results, and failure conditions.

**No unapproved `npx` downloads.** Use locally installed binaries
(`node_modules/.bin/...`) or stop and record that the tool is missing. Note that
the `npm test` and `npm run test:e2e` scripts call `npx` from the repo root, and
`vitest` / `@playwright/test` are root dependencies, not `mobile/` ones.

| Step | What | Gate |
| --- | --- | --- |
| V1-A | Install `mobile/` packages (`npm ci` in `mobile/`) | **Approval required** (package download) |
| V1-B | Install root packages (`npm ci` at repo root) so V4/V5 have `vitest` and Playwright | **Approval required**, separate from V1-A |
| V2-A | Place owner-supplied SQLite; verify provenance and hash | Preferred; no production access |
| V3 | `npm run build` in `mobile/` -> `dist/` | Needs V1-A and V2 data files |
| V4 | `npm test` in `mobile/` (Vitest, runs from root) | Needs V1-B |
| V5 | Install Chromium, then `npm run test:e2e` | **Approval required** (browser download); needs V1-B and `mobile/node_modules/.bin/vite` (the Playwright config runs `npx vite`; whether `npx` could fetch it is unverified) |
| V6 | `cap sync android`, then Gradle `assembleDebug` | **Approval required** (Gradle may download); needs V3 passed and `dist/` populated |
| V7 | `installDebug`, then Android smoke | **Approval required**, independent of V6 (device state change, and `installDebug` may download Gradle components). Emulator or approved test device only; airplane mode recorded and verified |
| V8a-d | iOS simulator build, install, launch, content checks | Manual; **V8a approval required** (`cap sync ios` and Xcode may fetch Swift packages; unverified); needs V3 passed and `dist/` populated |

Never run `cap sync` unless V3 succeeded and `dist/` is populated.

### Approval-only fallback: production content export

`scripts/export-content-db.mjs` (baseline V2-B) **reads production**. It is a
fallback for when no verified owner-supplied SQLite exists. It needs separate
explicit owner approval recorded in the evidence log, and must not be run as
part of any documentation or baseline-preparation work. This README
intentionally gives no ready-to-run invocation; take it from the baseline doc
only after approval.

### Android smoke (V7)

Requires its own explicit owner approval; V6 approval does not cover it. Use an
emulator or an approved test device only. Record the airplane-mode state
before the run and verify it was restored afterward; the suite toggles airplane
mode. If the state is not restored, V7 is FAIL.

### iOS simulator (V8)

Manual (no iOS automation was found in the initial inspection), split into
separately recorded sub-steps: build (V8a), install (V8b), launch (V8c), and
content checks in Arabic, English, and French (V8d). The clean-tree requirement
(V0) applies to the later baseline execution run, after documentation changes
are committed or accounted for.

## Prerequisites (summary)

Node.js (the root CI uses 22; the export script uses `node:sqlite`), npm,
root dependencies (`vitest`, `@playwright/test`), Playwright Chromium (a
download needing approval), a JDK and Android SDK platform 36 for Android, `adb`,
`python3` and `sqlite3` for the smoke suite, and macOS with Xcode and an iOS
Simulator runtime for iOS. Exact required versions for JDK, Xcode, and Android
Studio have **not** been established. See the baseline doc, section 3.

## Where results go

Record every run using the template in
[`docs/MOBILE-BASELINE.md`](../docs/MOBILE-BASELINE.md) section 6. A step that
was not run is `NOT RUN`, never an assumed pass.
