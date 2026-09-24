import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loginAndExpect } from "../utils/auth";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../../../playwright/.auth/user-checkout-enabled.json");

/**
 * Same login as auth.setup.ts, but captured against the checkout-enabled
 * server's own origin (see playwright.config.ts's checkoutEnabledBaseURL) --
 * browser storage is strictly origin-scoped, so playwright/.auth/user.json
 * (captured against the main server's origin) cannot be reused here even
 * though it's the same underlying Supabase account and session.
 */
setup("sign in and capture the shared session (checkout-enabled server)", async ({ page }) => {
  await page.goto("/auth?mode=login");
  await loginAndExpect(page, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!, () =>
    expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 5_000 }),
  );
  await page.context().storageState({ path: authFile });
});
