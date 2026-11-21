# QuranRoots Mobile Baseline (QR-MOBILE-STABILITY-001, PR 1)

**Status:** documentation only. None of the procedure in this document has
been executed. The only environment probe run while preparing it was
`node --version` (see 3.1). No dependency was installed, no build or test was
run, and no production data was read while writing it.

**Purpose:** record what is known about the Capacitor Android/iOS app today,
define a repeatable local verification procedure, and provide a template for
recording evidence. A later PR fills in the evidence. This PR does not.

Companion file: [`mobile/README.md`](../mobile/README.md) (developer-facing
orientation for the `mobile/` directory).

## 0. Legend

Every statement below carries one of these labels.

| Label | Meaning |
| --- | --- |
| **OBSERVED** | Read directly from a file in this repository at the commit this branch was cut from (`06349e1`). It says what the files contain. It does not say the app builds or runs. |
| **ASSUMPTION** | Believed, but not verified. Treat as a hypothesis to confirm or reject during verification. |
| **NOT RUN** | A command or check that is proposed here and has not been executed by anyone for this document. |

Statements in repository comments or READMEs (for example "known-good AVD",
"manually verified") are reported as **OBSERVED claims in the repo**, not as
facts verified by this baseline.

## 1. Scope and non-goals

In scope:

- Describe the existing `mobile/` architecture.
- List prerequisite tools and the checks to confirm them.
- Propose local verification commands with expected results and failure
  conditions.
- Provide an evidence template.

Out of scope for this PR (and prohibited while preparing it): installing
dependencies, running builds or tests, reading `.env` or any secret, running
the production content export, committing/pushing/merging/deploying, changing
billing, or changing Qur'an content.

## 2. Architecture (what the repository contains)

### 2.1 Layout

- **OBSERVED:** `mobile/` is a standalone project with its own `package.json`
  (`quranroots-mobile`, version `0.1.0`, `private`), `package-lock.json`,
  `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and
  `playwright.config.ts`.
- **OBSERVED:** `mobile/package.json` describes itself as an "Offline-first
  QuranRoots mobile app (Capacitor/Android) ... independent from the web app's
  Cloudflare/Nitro deployment. Not yet wired into any production build or
  deploy pipeline."
- **OBSERVED:** the repository root is a different app (TanStack Start /
  Cloudflare, with Supabase). `mobile/` does not use the root build.
- **OBSERVED:** `mobile/vite.config.ts` produces a plain static SPA into
  `mobile/dist`. Its header comment says it is deliberately not the
  TanStack Start or Cloudflare/Nitro configuration.

### 2.2 Web layer

- **OBSERVED:** React 19, `sql.js` 1.15 (SQLite compiled to WASM), `lucide-react`,
  Vite 8, TypeScript 5.9.
- **OBSERVED:** source is in `mobile/src/` (screens, components, `db.ts`,
  `local-store.ts`, `i18n.ts`, `navigation.ts`, `reading-position.ts`).
- **OBSERVED:** `mobile/src/db.ts` loads the content database with
  `fetch("/sql-wasm.wasm")` and fetches `/quran-content.sqlite`, then hands
  the WASM bytes to sql.js as `wasmBinary`. Comments in that file say this
  avoids `instantiateStreaming` failures seen in an iOS Simulator
  (WKWebView). That root-cause claim is **not re-verified here**.
- **OBSERVED:** `db.ts` itself notes that a later phase "should evaluate
  `@capacitor-community/sqlite`" because loading the whole database into WASM
  heap memory may not scale. This is a recorded design caveat.

### 2.3 Capacitor shell

- **OBSERVED:** `mobile/capacitor.config.ts`: `appId: "com.quranroots.app"`,
  `appName: "QuranRoots"`, `webDir: "dist"`. No server URL, no plugins block.
- **OBSERVED:** `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`,
  `@capacitor/ios` are all declared as `^8.5.3` in `devDependencies`.
- **OBSERVED:** the build does not copy web assets into the native projects by
  itself. `mobile/.gitignore` ignores `ios/App/App/public/` and
  `android/app/src/main/assets/public/`, described as "web assets Capacitor
  copies in from dist/ on every `cap sync`". So a `cap sync` step is required
  before a native build can contain the web app.

### 2.4 Android

- **OBSERVED:** Gradle project in `mobile/android/` (wrapper `gradlew` present).
- **OBSERVED:** `applicationId "com.quranroots.app"`, `versionCode 1`,
  `versionName "1.0"`, `minSdkVersion 24`, `compileSdkVersion 36`,
  `targetSdkVersion 36`.
- **OBSERVED:** `AndroidManifest.xml` declares `android.permission.INTERNET`
  and `android:allowBackup="true"`.
- **ASSUMPTION:** the INTERNET permission is the Capacitor default and the app
  makes no network calls in normal operation (the Android smoke README states
  "zero network calls" was "confirmed separately in the Android audit"; that
  audit is not in this repo, so it is unverified here).

### 2.5 iOS

- **OBSERVED:** Xcode project at `mobile/ios/App/App.xcodeproj`, with a Swift
  Package Manager package in `mobile/ios/App/CapApp-SPM` (no `Podfile`
  observed in the listing; `.gitignore` still lists `ios/App/Pods/`).
- **OBSERVED:** `IPHONEOS_DEPLOYMENT_TARGET = 15.0`, `MARKETING_VERSION = 1.0`,
  `CURRENT_PROJECT_VERSION = 1`, display name `QuranRoots Offline`.
- **OBSERVED — inconsistency:** `PRODUCT_BUNDLE_IDENTIFIER` is
  `com.quranroots.mobilefeasibility`, while Capacitor config and Android use
  `com.quranroots.app`. Nothing in this PR changes it. It must be resolved
  before any store submission. Which identifier is intended is **unknown**.

### 2.6 Content database

- **OBSERVED:** the app reads a bundled, read-only SQLite file
  (`quran-content.sqlite`) plus `sql-wasm.wasm` from `mobile/public/`. Both are
  gitignored (`mobile/.gitignore`), so a fresh checkout does not contain them.
- **OBSERVED:** `mobile/scripts/export-content-db.mjs` creates
  `mobile/content-db/quran-content.sqlite` and `manifest.json`, and copies the
  SQLite file to `mobile/public/`. Per its header it is read-only against
  production, uses the publishable key only, and reads `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` from the repo-root `.env`.
- **OBSERVED:** at the time of writing, `mobile/node_modules`, `mobile/dist`,
  `mobile/content-db`, and the root `node_modules` do not exist in this
  checkout.
- **OBSERVED:** `mobile/package.json` does not declare `vitest` or
  `@playwright/test`. Its `test` and `test:e2e` scripts `cd ..` and run
  `npx vitest` / `npx playwright` from the repo root, where both are declared
  (root `package.json`). The root has a `package-lock.json` and root CI runs
  `npm ci`. So V4 and V5 depend on a root dependency install that
  `cd mobile && npm ci` does not provide (see V1-B).
- **UNKNOWN:** how `sql-wasm.wasm` gets into `mobile/public/`. The export
  script's copy step only mentions the SQLite file, and `vite.config.ts` has no
  copy plugin. The `.gitignore` comment says `vite build` duplicates it. This
  must be established during verification (step V3).

### 2.7 Existing tests

- **OBSERVED:** unit tests under `mobile/src/*.test.ts` and
  `mobile/scripts/*.test.ts`, run via `mobile/vitest.config.ts` (the npm script
  `cd ..`s to the repo root and uses `--config mobile/vitest.config.ts`).
- **OBSERVED:** Playwright specs in `mobile/e2e/*.spec.ts` against desktop
  Chromium at 390x844, served by `npx vite --port 5190`. The config comment says
  it needs no Supabase or network.
- **OBSERVED:** `mobile/e2e/android-smoke/` holds a Bash/`adb`/UI Automator
  suite (`run.sh`, `lib.sh`, README) that drives an already-installed app on a
  running emulator/device. Its README states it is not wired into CI and has
  only been run on a Pixel 9 / API 35 emulator.
- **OBSERVED (initial inspection):** no file under `.github/workflows/`
  mentions `mobile`. The three workflows found were `ci.yml`,
  `production-deploy.yml`, `production-validation.yml`. On that basis no
  mobile-specific CI was found. This is an initial-inspection finding, **not an
  exhaustive audit**: it does not rule out coverage through broad path globs,
  reusable workflows, external CI, or configuration outside the repository, and
  those were not checked.
- **OBSERVED:** the repo's own docs say Playwright results must not be cited as
  evidence of on-device behavior. This baseline keeps that rule: web-level and
  on-device results are recorded separately.
- **NOT FOUND (initial inspection):** no iOS on-device or simulator test
  automation was found in the repository. This reflects the files looked at so
  far, not an exhaustive search; absence is not proven.

### 2.8 Quick risk register (hypotheses, not findings)

| # | Item | Basis |
| --- | --- | --- |
| R1 | Bundle ID mismatch iOS vs Android/Capacitor | OBSERVED (2.5) |
| R2 | Fresh checkout cannot build without the content database files. They come either from an owner-supplied, provenance- and hash-verified SQLite artifact (preferred, V2-A) or from the export script, which needs production read access and a root `.env` (fallback, V2-B, separate approval) | OBSERVED (2.6) |
| R3 | No mobile CI found (initial inspection, not an exhaustive audit) | OBSERVED (2.7); absence not proven |
| R4 | `allowBackup="true"` on a bundled-content app | OBSERVED value; impact ASSUMPTION |
| R5 | Whole DB loaded into WASM heap; memory on low-end devices | ASSUMPTION (flagged in `db.ts` comment) |
| R6 | App cold-boots to Home and does not restore position | OBSERVED claim in smoke README, unverified here |
| R7 | Node version required by `node:sqlite` in the export script | ASSUMPTION (see 3.1) |

## 3. Prerequisites

### 3.1 Tool table

"Observed requirement" means a file in the repo implies it. "Version" columns
are what to record. Actual installed versions on any machine are **not known**
to this document, except the one noted.

| Tool | Needed for | Basis | How to check (NOT RUN) |
| --- | --- | --- | --- |
| Node.js | everything | Root CI uses Node 22 (OBSERVED, `ci.yml`). The export script imports `node:sqlite`, which ASSUMPTION needs a recent Node 22 line. | `node --version` |
| npm | install | `package-lock.json` present in `mobile/` and at the repo root (OBSERVED) | `npm --version` |
| Root dependencies (`vitest`, `@playwright/test`) | V4 unit tests, V5 e2e | Declared in root `package.json`, not in `mobile/package.json` (OBSERVED). Installing them (V1-B) is a **package download needing separate owner approval**. | Check for a local binary only: `test -x node_modules/.bin/vitest`, `test -x node_modules/.bin/playwright` (from repo root). Do not use `npx` to check. |
| Git | branch checks | n/a | `git --version` |
| Playwright Chromium | web e2e | `mobile/playwright.config.ts` (OBSERVED). Installing it is a **software download that needs separate owner approval** (see V5). | `node_modules/.bin/playwright --version` (repo root; only after approved root install). Never `npx` for this check. |
| JDK | Android build | ASSUMPTION: the version required by the Gradle/AGP in `mobile/android` has not been read. Record it from the Gradle files before step V6. | `java -version` |
| Android SDK, platform 36 | Android build | `compileSdkVersion 36` (OBSERVED) | `sdkmanager --list_installed` |
| `adb` | on-device smoke | smoke README (OBSERVED) | `adb version` |
| Android emulator or device | on-device smoke | smoke README (OBSERVED); README names AVD `Pixel_9` API 35 | `emulator -list-avds`, `adb devices` |
| `python3` | smoke suite | smoke README (OBSERVED) | `python3 --version` |
| `sqlite3` CLI | smoke suite | smoke README (OBSERVED) | `sqlite3 --version` |
| macOS + Xcode | iOS build | iOS project exists (OBSERVED); Xcode version requirement not read | `xcodebuild -version` |
| iOS Simulator runtime | iOS run | `IPHONEOS_DEPLOYMENT_TARGET 15.0` (OBSERVED) | `xcrun simctl list runtimes` |

Local observation made while preparing this document: `node --version`
printed `v22.23.2` on the authoring machine. Nothing else was probed.

### 3.2 Secrets and data rules

- Do not open, print, or commit `.env` or any key. Record only
  "present / not present".
- The content export script reads production. Preferred path (V2): use an
  existing owner-supplied SQLite artifact with verified provenance and a
  matching hash. A fresh production export is a fallback only, requires
  separate explicit owner approval, and the evidence log must record that
  approval. This documentation PR never runs the export.
- Never use a service-role key for anything in `mobile/`.
- Do not modify Qur'an content, billing, or deployment configuration as part of
  verification.

## 4. Proposed verification procedure (all NOT RUN)

Run from the repository root unless stated. Record each result in section 6.
Stop at the first failure and file it; do not "fix forward" inside the
verification run.

Any step that installs packages or software, downloads artifacts (including
Gradle dependencies), accesses production, or changes device state is marked
**APPROVAL REQUIRED** below and needs its own explicit owner approval, recorded
in the evidence log, before execution. Approval for one such step does not
cover another. Gated steps: V1-A, V1-B, V2-B, V5 (Chromium download, and the
Playwright web server; see V5), V6 (possible Gradle downloads), V7 (device
state and its own Gradle `installDebug`), V8a (possible Swift Package Manager
downloads).

**No unapproved `npx` downloads.** `npx <tool>` can silently download and run a
package that is not installed locally. Use only locally installed binaries
(`node_modules/.bin/<tool>`, or the npm scripts after an approved install). If
a required tool is not installed locally, **stop and record it**; do not let
`npx` fetch it. The `npm test` and `npm run test:e2e` scripts use `npx`
internally (they `cd ..` and call `npx vitest` / `npx playwright`), so run them
only after V1-B has put those binaries in the root `node_modules`, and stop if
either is missing.

### V0 — Preconditions

V0 applies to the **later baseline execution run**, not to this
documentation-only PR. By then the documentation changes (this PR) must be
committed or otherwise accounted for (for example merged, or listed explicitly
in the evidence record), so that a clean tree is meaningful.

| | |
| --- | --- |
| Commands | `git branch --show-current`, `git rev-parse HEAD`, `git status --short` |
| Expected | Intended branch, a recorded SHA, clean tree (documentation changes already committed or explicitly accounted for) |
| Failure | Dirty tree with unaccounted changes, or unexpected branch: stop, record, do not continue |

### V1-A — Install mobile dependencies (**APPROVAL REQUIRED**; modifies `mobile/node_modules`)

| | |
| --- | --- |
| Approval gate | Downloads packages from the npm registry. Separate explicit owner approval, recorded in the evidence log, before running. If not approved, V1-A and everything that depends on it is `NOT RUN`. |
| Command | `cd mobile && npm ci` |
| Expected | Exit 0; lockfile unchanged (`git status --short` still clean) |
| Failure | Non-zero exit, engine warnings that block, or `package-lock.json` modified. Use `npm ci`, not `npm install`, so the lockfile is not rewritten. |

### V1-B — Install root dependencies for V4/V5 (**APPROVAL REQUIRED**; modifies root `node_modules`)

`vitest` and `@playwright/test` are declared only at the repo root, and the
mobile `test` / `test:e2e` scripts run from there (see 2.6). V1-A does not
provide them.

| | |
| --- | --- |
| Approval gate | Separate explicit owner approval from V1-A. Downloads the full root dependency tree. If not approved, V4 and V5 are `NOT RUN`. |
| Command | `npm ci` from the repo root |
| Expected | Exit 0; root `package-lock.json` unchanged; `node_modules/.bin/vitest` and `node_modules/.bin/playwright` exist |
| Failure | Non-zero exit, lockfile modified, or either binary missing. Do not fall back to `npx`. |

### V2 — Obtain content database

**Preferred (V2-A): existing owner-supplied artifact.** No production access.

| | |
| --- | --- |
| Action | Owner supplies an existing `quran-content.sqlite` (and its manifest if available). Place it where the build expects it (`mobile/public/`, and `mobile/content-db/` for the smoke suite) |
| Preconditions | Provenance recorded (who supplied it, when, from which export); a known-good hash or manifest to compare against |
| Expected | SHA-256 of the file matches the recorded hash; if a manifest exists, its overall content hash and `segment_text_sha256_mismatches = 0` are recorded |
| Failure | No provenance, no reference hash, or hash mismatch: do not use the file; stop and record. The source and reference hash of any such artifact are currently **unknown**. |

**Fallback (V2-B): fresh production export. Needs separate explicit owner
approval; never run as part of this PR.**

| | |
| --- | --- |
| Command | `node mobile/scripts/export-content-db.mjs` |
| Preconditions | Separate explicit owner approval recorded, stating V2-A was unavailable; root `.env` with production URL and publishable key supplied by the owner (do not display it) |
| Expected | Exit 0; `mobile/content-db/quran-content.sqlite` and `manifest.json` created; file copied to `mobile/public/`; script prints an overall content hash; `segment_text_sha256_mismatches` in the manifest is 0 |
| Failure | Missing env vars (script refuses), URL that looks local (script refuses), HTTP error, non-zero mismatches, or any unexpected change under tracked files |

| | |
| --- | --- |
| Note | Generated outputs are gitignored. Confirm with `git status --short` that nothing tracked changed. |

### V3 — Web bundle build

| | |
| --- | --- |
| Preconditions | V1-A completed (`mobile/node_modules/.bin/vite` exists; do not let `npx` fetch it) and the content database files are in `mobile/public/` (V2-A preferred) |
| Command | `cd mobile && npm run build` |
| Expected | Exit 0; `mobile/dist/` contains `index.html`, JS/CSS, and (to be established) `quran-content.sqlite` and `sql-wasm.wasm` |
| Failure | TypeScript/Vite errors; either data file missing from `dist/`. If `sql-wasm.wasm` is missing, record the gap (see 2.6); do not hand-copy silently. |
| Record | Sizes of `dist/` and of the two data files |

### V4 — Unit tests

| | |
| --- | --- |
| Precondition | V1-B completed and `node_modules/.bin/vitest` exists at the repo root. If not, stop; V4 is `NOT RUN`. Do not let `npx` download it. |
| Command | `cd mobile && npm test` |
| Expected | Exit 0; zero failed; record the pass/total counts |
| Failure | Any failure; or "no tests found" (config/path problem) |

### V5 — Web e2e (desktop Chromium, not on-device evidence)

| | |
| --- | --- |
| Precondition | V1-B completed and `node_modules/.bin/playwright` exists at the repo root. If not, stop; V5 is `NOT RUN`. Do not let `npx` download it. |
| Web-server precondition (`npx vite`) | OBSERVED: `mobile/playwright.config.ts` starts its server with `npx vite --port 5190 --strictPort` and sets no `cwd`. **ASSUMPTION (not verified here):** Playwright runs `webServer` commands from the config file's directory (`mobile/`), so `npx` would look in `mobile/node_modules/.bin` and then parent directories. **UNKNOWN:** whether `npx` would fetch `vite` from the network if no local copy is found (this depends on the npm version and environment), and which local `vite` it would pick if both `mobile/` and the root have one. Before running V5, confirm `mobile/node_modules/.bin/vite` exists (from V1-A). If it does not, stop and record; V5 is `NOT RUN`. The config must not be modified in this series. |
| Approval gate | Installing Chromium is a **software download** (a browser binary). It needs separate explicit owner approval before execution, recorded in the evidence log. If not approved, V5 is `NOT RUN`. |
| Commands | After approval, from the repo root: `node_modules/.bin/playwright install chromium` (locally installed binary, not `npx`), then `cd mobile && npm run test:e2e` |
| Expected | Exit 0; all specs pass; no network needed to run the specs |
| Failure | Port 5190 in use (`--strictPort`); missing data files; any spec failure. Keep `playwright-report/` and `test-results/` (gitignored) for the evidence log. |

### V6 — Android debug build (**APPROVAL REQUIRED**: Gradle may download)

| | |
| --- | --- |
| Approval gate | The Gradle wrapper and build **may download** a Gradle distribution and dependencies (not verified here; treat as possible). Separate explicit owner approval, recorded in the evidence log, before `./gradlew`. If not approved, V6 is `NOT RUN`. |
| Preconditions | V1-A completed and `mobile/node_modules/.bin/cap` exists (use it, not `npx`). **V3 passed** (exit 0) and `mobile/dist/` exists and is populated (contains `index.html` and the assets V3 expects). If V3 did not pass or `dist/` is empty or missing, do not run `cap sync`; V6 is `NOT RUN`. |
| Commands | `cd mobile && node_modules/.bin/cap sync android`, then `cd android && ./gradlew assembleDebug` |
| Expected | Both exit 0; a debug APK produced under `android/app/build/outputs/apk/debug/`; `android/app/src/main/assets/public/` populated by sync |
| Failure | SDK platform 36 missing, JDK mismatch, Gradle download/network failure, sync error, dirty tracked files after sync (record exact files) |
| Note | `./gradlew installDebug` (used by the smoke README) installs onto a connected device or emulator and is a separate step (V7). |

### V7 — Android on-device smoke (**APPROVAL REQUIRED**, independent of V6)

| | |
| --- | --- |
| Approval gate | Separate explicit owner approval for V7 itself, recorded in the evidence log, covering (a) changing state on the chosen emulator/device (the suite toggles airplane mode) and (b) the `./gradlew installDebug` step, which may download Gradle components (unverified) and installs the app. V6 approval does **not** cover V7, and V7 approval does not cover V6. If not approved, V7 is `NOT RUN`. |
| Target | An **emulator or an owner-approved test device only**. Not a personal or production device. Record which, and who approved it. |
| Before the run | Record the device's airplane-mode state (for example `adb shell settings get global airplane_mode_on`) in the evidence log, before any install or smoke command. |
| Commands (in order) | 1. Start the emulator. 2. `cd mobile/android && ./gradlew installDebug` (covered by the V7 approval above, not by V6). 3. `cd` back to the repo root (for example `cd ../..`). 4. `./mobile/e2e/android-smoke/run.sh <output_dir>`. (`run.sh` resolves its own paths from its location, but the relative path in step 4 assumes the repo root.) |
| After the run | Read the airplane-mode state again and verify it equals the recorded starting state. If it differs, restore it manually and record the discrepancy; **V7 is FAIL regardless of the script's own result**. A script exit code alone is not evidence of restoration. |
| Expected | Exit 0 (all checks pass), UI dumps saved under `<output_dir>`, airplane mode confirmed restored to its recorded original state |
| Failure | No device, app not installed, `sqlite3` or `python3` missing, `mobile/content-db/quran-content.sqlite` missing, any failed check, or airplane-mode state not restored. Record the failing check number and the dump file. |
| Caution | The suite toggles the device's airplane mode (OBSERVED claim in its README). This is why only an emulator or approved test device may be used. |

### V8 — iOS simulator (four separate sub-steps; V8a is **APPROVAL REQUIRED**)

Each sub-step is recorded separately with its own evidence. A pass on one does
not imply a pass on the next (a build can succeed while the app fails to
launch, and a launch can succeed while content fails to load). No iOS
automation was found in the initial inspection (see 2.7); these are manual.

**V8a approval gate.** `cap sync ios`, `xcodebuild -list`, and `xcodebuild`
build may resolve and fetch Swift Package Manager dependencies. The iOS project
uses a Swift package (`mobile/ios/App/CapApp-SPM`, OBSERVED); whether its
dependencies are local-only or fetched from the network has **not** been
verified. Do not run any of those commands without separate explicit owner
approval, recorded in the evidence log, that names V8a and acknowledges possible
package downloads. V1-A/V1-B/V6 approvals do not cover it. If not approved,
V8a-V8d are `NOT RUN`.

| Sub-step | What | Commands / action | Expected | Distinct evidence to record |
| --- | --- | --- | --- | --- |
| V8a | Build | Preconditions: V8a approval recorded (see gate above), V1-A completed, **V3 passed** and `mobile/dist/` is populated (otherwise do not run `cap sync`; V8a is `NOT RUN`). Then `cd mobile && node_modules/.bin/cap sync ios`, then `xcodebuild` against `mobile/ios/App/App.xcodeproj` for an iOS Simulator destination (exact scheme/destination recorded from `xcodebuild -list`) | Build succeeds | Command, exit code, log path, `.app` output path |
| V8b | Install | Install the built `.app` on a chosen simulator (for example `xcrun simctl install`) | Install exits 0; app listed on the simulator | Command, exit code, simulator name/runtime/UDID, bundle ID actually installed (R1) |
| V8c | Launch | Launch the installed app (for example `xcrun simctl launch`) | App starts and reaches its first screen without crash or blank screen | Command, exit code, screenshot of first screen, any crash/console output |
| V8d | Content checks | With the app running, check Al-Fatiha content in each language. Three separate records: **V8d-ar** Arabic, **V8d-en** English, **V8d-fr** French | Each language renders Al-Fatiha correctly (Arabic text shaping and RTL, English text, French text) | One screenshot and one PASS/FAIL note per language |

| | |
| --- | --- |
| Failure | Signing errors (no team configured: record, do not edit project), SPM resolution failure (V8a); install failure or bundle ID confusion (V8b); crash or blank screen / WASM load failure, see the `db.ts` comment (V8c); missing, garbled, or wrong-language content (V8d, per language) |
| Note | If an earlier sub-step fails, later sub-steps are `NOT RUN`, not failed. |

### V9 — Post-run hygiene

| | |
| --- | --- |
| Commands | `git status --short`, `git diff --stat` |
| Expected | No tracked file changed by the run. Only gitignored outputs. |
| Failure | Any tracked change (for example from `cap sync` or Xcode): list it and do not commit it in the baseline PR |

## 5. Interpretation rules

- A step is **PASS** only with command, exit code, and a captured output
  excerpt in section 6.
- A step not run is **NOT RUN**, never "assumed pass".
- Web-level results (V3-V5) must not be reported as on-device results (V7-V8).
- V8a-V8d (and V8d per language) are judged and recorded independently.
- A skipped step needs a reason and an owner decision.
- Any production access must have a recorded approval and the data source.

## 6. Evidence-recording template

Copy this block per verification run into a new file or PR description. Fill
every field; use `n/a` or `NOT RUN` rather than leaving blanks.

```markdown
### Run <YYYY-MM-DD> — <runner>

- Branch / commit SHA:
- Working tree clean at start (V0): yes / no
- Machine: OS + version, CPU arch
- Tool versions: node=  npm=  java=  Android SDK platform(s)=  adb=
  xcodebuild=  simulator runtime=  python3=  sqlite3=
- Device / emulator: name, API/iOS level, physical or virtual
- Production access used (V2-B)? yes / no — approval reference:
- Mobile `npm ci` (V1-A) approved? yes / no — approval reference:
- Root `npm ci` (V1-B) approved? yes / no — approval reference:
- Playwright Chromium download (V5) approved? yes / no — approval reference:
- Gradle possible download (V6) approved? yes / no — approval reference:
- V7 (device state + installDebug) approved? yes / no — approval reference:
- V8a (possible Swift package downloads) approved? yes / no — approval reference:
- Any `npx` auto-download occurred? yes / no (must be no):
- Android airplane-mode state before V7 / after V7 / restored (yes/no):
- Content DB source: supplied by <who> with provenance <ref> (preferred) /
  exported on <date> under approval <ref> (fallback)
  - SHA-256 of quran-content.sqlite:
  - manifest overall content hash:
  - segment_text_sha256_mismatches:

| Step | Command run (exact) | Exit code | Result (PASS / FAIL / NOT RUN) | Evidence (log path, excerpt, counts) | Notes |
| --- | --- | --- | --- | --- | --- |
| V0 |  |  |  |  |  |
| V1-A |  |  |  |  |  |
| V1-B |  |  |  |  |  |
| V2 |  |  |  |  |  |
| V3 |  |  |  |  |  |
| V4 |  |  |  |  |  |
| V5 |  |  |  |  |  |
| V6 |  |  |  |  |  |
| V7 |  |  |  |  |  |
| V8a build |  |  |  |  |  |
| V8b install |  |  |  |  |  |
| V8c launch |  |  |  |  |  |
| V8d-ar Arabic |  |  |  |  |  |
| V8d-en English |  |  |  |  |  |
| V8d-fr French |  |  |  |  |  |
| V9 |  |  |  |  |  |

- Tracked files modified by the run (V9):
- Deviations from this procedure:
- New issues found (id, summary, step, severity):
- Assumptions confirmed / rejected (from section 2):
- Open questions:
- Sign-off: <name>, <date>
```

## 7. Open questions for the owner

1. Which bundle identifier is correct for iOS: `com.quranroots.app` or
   `com.quranroots.mobilefeasibility`?
2. Can the owner supply an existing `quran-content.sqlite` with verified
   provenance and a reference hash (preferred, V2-A)? A production export
   (V2-B) would need separate explicit approval.
3. What is the intended minimum Node, JDK, Xcode, and Android Studio versions?
   (Related: should `mobile/package.json` declare its own test tooling instead
   of relying on root dependencies? Out of scope for this PR.)
4. Is mobile CI in scope for a later PR in this series?
5. Is `allowBackup="true"` intended?
6. How does `sql-wasm.wasm` reach `mobile/public/`?

## 8. What this PR changes

Adds two files: `mobile/README.md` and `docs/MOBILE-BASELINE.md`. No code,
configuration, dependency, content, billing, or deployment change.
