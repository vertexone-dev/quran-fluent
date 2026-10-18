import { defineConfig } from "@playwright/test";

/**
 * Scoped to the mobile/ app only, deliberately separate from the root
 * playwright.config.ts: that suite needs a local Supabase stack (specs
 * 06/17/21/48/50 run against local dev's own seeded database) this
 * engagement has never stood up, and its one production-safe spec (51)
 * writes a real test user via createTestUserClient(), which this app must
 * never do against production. The mobile app has no such dependency at
 * all -- every screen reads the bundled, already-exported SQLite file, so
 * this suite needs nothing but `npm run dev` here, no Supabase, no
 * database, no network of any kind. Run with `npx playwright test
 * --config mobile/playwright.config.ts` from the repo root, or `npm run
 * test:e2e` from mobile/.
 */
const PORT = 5190;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { viewport: { width: 390, height: 844 }, browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
