import { test, expect } from "@playwright/test";

import { loginAndExpect } from "./utils/auth";

/**
 * Runs in the "public" project (no stored session). Uses the shared
 * E2E_TEST_EMAIL/PASSWORD account for the login case; signup/reset cases use
 * throwaway data so they never touch that account's state.
 */

test.describe("auth", () => {
  test("unauthenticated visitor is redirected away from a protected route", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/auth\?mode=login/);
  });

  test("login form rejects an invalid submission client-side", async ({ page }) => {
    await page.goto("/auth?mode=login");

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");

    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();

    // Client-side validation must block the request entirely.
    await expect(page).toHaveURL(/\/auth\?mode=login/);
  });

  test("wrong password shows an error and does not sign in", async ({ page }) => {
    await page.goto("/auth?mode=login");

    await loginAndExpect(
      page,
      process.env.E2E_TEST_EMAIL!,
      "definitely-the-wrong-password-123",
      () =>
        expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({
          timeout: 5_000,
        }),
    );

    await expect(page).toHaveURL(/\/auth\?mode=login/);
  });

  test("valid credentials log the test account in", async ({ page }) => {
    await page.goto("/auth?mode=login");

    await loginAndExpect(page, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!, () =>
      expect(page).toHaveURL(/\/(dashboard|onboarding)/, {
        timeout: 5_000,
      }),
    );
  });

  test("logging out clears the session and blocks protected routes again", async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto("/auth?mode=login");

    await loginAndExpect(page, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!, () =>
      expect(page).toHaveURL(/\/(dashboard|onboarding)/, {
        timeout: 10_000,
      }),
    );

    // Move to a normal authenticated page that contains the desktop header.
    await page.goto("/quran");

    await expect(page).toHaveURL(/\/quran/, {
      timeout: 10_000,
    });

    // Stable locator that does not change when the app switches EN/FR.
    const accountMenu = page.getByTestId("account-menu-trigger");

    await expect(accountMenu).toBeVisible({
      timeout: 10_000,
    });

    await accountMenu.click();

    const logoutItem = page.getByTestId("logout-menu-item");

    await expect(logoutItem).toBeVisible({
      timeout: 5_000,
    });

    await logoutItem.click();

    await expect(page).toHaveURL(/\/auth/, {
      timeout: 10_000,
    });

    // Confirm the session itself was cleared.
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/auth\?mode=login/, {
      timeout: 10_000,
    });
  });

  test("forgot-password mode accepts a submission without revealing account existence", async ({
    page,
  }) => {
    await page.goto("/auth?mode=forgot");

    // Same documented cold-compile hydration-remount race as login (see
    // utils/auth.ts): the /auth route can occasionally regenerate its tree
    // client-side shortly after first render, discarding form state
    // Playwright had just filled. Unlike login, this mode's handleSubmit
    // awaits a real, rate-limited Supabase Auth call (resetPasswordForEmail)
    // — retrying the *whole* submission (fillUntil's original approach)
    // re-fires that real network call on every attempt, and previously
    // compounded real latency/rate-limiting until Playwright force-closed
    // the page mid-retry ("locator.fill: Target page, context or browser
    // has been closed"). Bounded to 2 attempts (not 3) to cap how many real
    // requests a flaky run can fire, with a page-closed guard so a timed-
    // out first attempt can't try to act on a torn-down page.
    const emailInput = page.getByLabel("Email");
    const probeEmail = "no-such-account-e2e-probe@example.com";
    const successText = page.getByText(
      "If that address has an account, a password reset link is on its way.",
    );

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (page.isClosed()) break;
      try {
        // The whole attempt — fill through the network-bound success wait
        // — is inside this try so a remount that wipes the just-typed
        // value (caught by the value assertion below) retries the entire
        // thing, not just the final wait. A 3s bound on the value check
        // lets a wiped value fail fast into a retry instead of burning
        // most of the attempt's budget on a check that's already lost.
        await expect(emailInput).toBeVisible();
        await emailInput.fill(probeEmail);
        await expect(emailInput).toHaveValue(probeEmail, { timeout: 3_000 });
        await page.getByRole("button", { name: "Send reset link" }).click();
        await expect(successText).toBeVisible({ timeout: 10_000 });
        return;
      } catch (error) {
        if (attempt === 2 || page.isClosed()) throw error;
      }
    }
  });
});
