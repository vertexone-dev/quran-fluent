import { type Page, expect } from "@playwright/test";

/**
 * On a cold `vite dev` compile, the /auth route can hydration-remount
 * shortly after first load (framework quirk, verified via trace: the click
 * lands but no request ever reaches Supabase because the remount reset the
 * form state Playwright had just filled). Retrying the whole fill+submit
 * is more reliable than trying to detect "hydration settled" from outside
 * the app, and self-heals once the route is warm.
 */
async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function loginAndExpect(
  page: Page,
  email: string,
  password: string,
  expected: () => Promise<void>,
  attempts = 3,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await submitLogin(page, email, password);
    try {
      await expected();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}
