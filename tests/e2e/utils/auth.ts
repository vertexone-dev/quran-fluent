import { type Locator, type Page, expect } from "@playwright/test";

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

/**
 * Same hydration-remount race as loginAndExpect above, generalized to any
 * click: on a cold `vite dev` compile, a click can land on a DOM node right
 * before React replaces it during hydration, so the click event fires but
 * no listener (or a since-discarded one) ever handles it -- confirmed for
 * this exact symptom on /premium's Checkout buttons (a click with no
 * visible effect: no request, no disabled state, no error toast). Retrying
 * the whole click is more reliable than waiting for "hydration settled"
 * from outside the app (e.g. networkidle, which can resolve before
 * React's hydration commit finishes since hydration itself causes no
 * network activity), and self-heals once the route is warm.
 */
export async function clickAndExpect(
  locator: Locator,
  expected: () => Promise<void>,
  attempts = 3,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await locator.click();
    try {
      await expected();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}
