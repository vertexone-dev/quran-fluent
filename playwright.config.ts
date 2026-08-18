import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, ".env.test") });

const PORT = 4300;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * A single shared E2E_TEST_EMAIL account is reused across every spec, so
 * specs must not mutate that account's data concurrently. fullyParallel is
 * off and workers is pinned to 1 for that reason, not for speed.
 */
export default defineConfig({
  testDir: "./tests/e2e",
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
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public",
      testMatch: ["auth.spec.ts", "security.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authenticated",
      testMatch: [
        "onboarding.spec.ts",
        "placement.spec.ts",
        "daily-study.spec.ts",
        "learning.spec.ts",
        "vocabulary.spec.ts",
        "quran-reader.spec.ts",
        "memorization.spec.ts",
        "progress.spec.ts",
        "localization.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
  },
});
