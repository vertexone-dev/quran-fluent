import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loginAndExpect } from "../utils/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../../../playwright/.auth/user.json");

// Account data reset (including interface_language) happens once in
// global-setup.ts, before every project — not here. This project runs
// between "public" and "authenticated" purely to capture the one browser
// session every authenticated spec shares (see utils/db.ts).
setup("sign in and capture the shared session", async ({ page }) => {
  await page.goto("/auth?mode=login");
  // Login always navigates to /dashboard; a client-side effect then bounces
  // to /onboarding when onboarding_completed is false (it is, post-reset).
  await loginAndExpect(page, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!, () =>
    expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 5_000 }),
  );
  await page.context().storageState({ path: authFile });
});
