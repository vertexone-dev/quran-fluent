import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, ".env.test") });

const PORT = 4300;
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? `http://localhost:${PORT}`;

/**
 * A single shared E2E_TEST_EMAIL account is reused across every spec, so
 * specs must not mutate that account's data concurrently. fullyParallel is
 * off and workers is pinned to 1 for that reason, not for speed.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Resets the shared account's data (including interface_language) once,
  // before any project — including "public", which now runs before the
  // "setup" project below and needs a clean English baseline regardless of
  // what a prior (possibly interrupted) run left behind.
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // "public" must run before "setup": auth.spec.ts does real UI
    // logins/logout against the shared test account, and Supabase Auth
    // revokes a user's other sessions once a new one signs in. Running
    // those first means setup's own login — the one every authenticated
    // spec's storageState depends on — is the last, uncontested sign-in.
    {
      name: "public",
      testMatch: ["auth.spec.ts", "security.spec.ts", "16-curriculum-schema.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "setup", testMatch: /auth\.setup\.ts/, dependencies: ["public"] },
    {
      name: "authenticated",
      // Numbered filenames, not this array, control run order: Playwright
      // always runs spec files in sorted-path order regardless of how
      // they're listed here. The learner-journey order matters — e.g.
      // 02-learning.spec.ts asserts a "no placement taken yet" empty state
      // that 03-placement.spec.ts would otherwise have already spoiled.
      testMatch: [
        "01-onboarding.spec.ts",
        "02-learning.spec.ts",
        "03-placement.spec.ts",
        "04-daily-study.spec.ts",
        "05-vocabulary.spec.ts",
        "06-quran-reader.spec.ts",
        "08-progress.spec.ts",
        "09-localization.spec.ts",
        "10-bookmarks.spec.ts",
        "11-notes.spec.ts",
        "12-memorization.spec.ts",
        "13-practice.spec.ts",
        "14-translation-fallback.spec.ts",
        "15-full-dataset.spec.ts",
        "17-lesson-player.spec.ts",
        "18-level1-pilot.spec.ts",
        "19-level1-module2.spec.ts",
        "20-level1-module2-chunk2.spec.ts",
        "21-lesson-review-integration.spec.ts",
        "22-placement-curriculum.spec.ts",
        "23-daily-learning-plan.spec.ts",
        "24-practice-concept-review.spec.ts",
        "25-level1-module3-harakat.spec.ts",
        "26-level1-module4-sukun-shadda.spec.ts",
        "27-level1-module5-tanwin.spec.ts",
        "28-level1-module6-connected-letter-forms.spec.ts",
        "29-level1-module7-first-reading-practice.spec.ts",
        "30-level1-module8-reading-al-fatiha.spec.ts",
        "31-level1-release-journey.spec.ts",
        "32-level2-batch1-vocabulary-and-orthography.spec.ts",
        "33-level2-batch2-core-vocabulary-2-and-short-phrases.spec.ts",
        "34-level2-batch3-vocabulary-capstone.spec.ts",
        "35-level2-release-journey.spec.ts",
        "37-level3-batch1-arabic-roots-intro-and-word-patterns.spec.ts",
        "38-level3-batch2-roots-capstone.spec.ts",
        "39-level3-release-journey.spec.ts",
        "40-level4-batch1-pronouns-and-agreement.spec.ts",
        "41-level4-batch2-grammar-capstone.spec.ts",
        "42-i18n-foundation-phase1.spec.ts",
        "43-level5-batch1-attached-particles.spec.ts",
        "44-level5-batch2-imperative-capstone.spec.ts",
        "45-audio-foundation.spec.ts",
        "46-audio-preferred-reciter.spec.ts",
        "47-memorization-audio.spec.ts",
        "48-lesson-position-race.spec.ts",
        "49-french-translation-remediation.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  // Omitted entirely (rather than pointed at baseURL) when PLAYWRIGHT_BASE_URL
  // targets an external deployment: Playwright's webServer pre-flight check
  // fails fast with "url is already used" against a live URL that's already
  // responding, since reuseExistingServer is forced off in CI.
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: "pipe",
      },
});
