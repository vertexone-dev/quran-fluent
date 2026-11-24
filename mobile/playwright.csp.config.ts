import { defineConfig } from "@playwright/test";

/**
 * CSP compatibility test (QR-RELEASE-002A). Runs against the BUILT app served by
 * `vite preview`, because only the built index.html carries the policy.
 * Run: `npx playwright test --config mobile/playwright.csp.config.ts` from the repo root
 * (needs the bundled database in mobile/public, as the main suite does).
 */
const PORT = 5193;

export default defineConfig({
  testDir: "./e2e-csp",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 390, height: 844 },
    browserName: "chromium",
  },
  webServer: {
    command: `npx vite build --outDir dist-csp && npx vite preview --outDir dist-csp --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
