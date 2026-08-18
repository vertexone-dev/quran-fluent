import { test, expect } from "@playwright/test";

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
    await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Password").fill("definitely-the-wrong-password-123");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth\?mode=login/);
  });

  test("valid credentials log the test account in", async ({ page }) => {
    await page.goto("/auth?mode=login");
    await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 10_000 });
  });

  test("logging out clears the session and blocks protected routes again", async ({ page }) => {
    await page.goto("/auth?mode=login");
    await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 10_000 });

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/auth/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\?mode=login/);
  });

  test("forgot-password mode accepts a submission without revealing account existence", async ({
    page,
  }) => {
    await page.goto("/auth?mode=forgot");
    await page.getByLabel("Email").fill("no-such-account-e2e-probe@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByText("If that address has an account, a password reset link is on its way."),
    ).toBeVisible();
  });
});
