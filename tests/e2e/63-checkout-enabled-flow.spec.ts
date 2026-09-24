import { test, expect } from "@playwright/test";
import type { Route } from "@playwright/test";

import { clickAndExpect } from "./utils/auth";

/**
 * Runs against the second local dev server built with
 * VITE_BILLING_CHECKOUT_ENABLED=true (see playwright.config.ts's
 * checkoutEnabledBaseURL/CHECKOUT_ENABLED_PORT) -- the only place this
 * repo's E2E suite can genuinely exercise the "checkout enabled" UI state,
 * since the flag is compiled into the client bundle at server-start time,
 * not readable/settable at runtime.
 *
 * Every test here mocks POST /api/billing/checkout directly (never
 * contacts Stripe, live or test) and, where a session would redirect,
 * points the mocked response at a same-origin URL so no real external
 * network request is ever made, even by the browser's own navigation.
 *
 * Every click below goes through clickAndExpect (tests/e2e/utils/auth.ts)
 * rather than a plain `.click()` + assertion: root-caused via trace that a
 * click landing right as this SSR app's hydration commits can silently
 * have no effect (no request, no disabled state, no toast) on this
 * project's freshly started server -- the same class of race
 * tests/e2e/utils/auth.ts's loginAndExpect already documents for /auth.
 */

const MOCK_SESSION_URL_MONTHLY = "/premium?mock-checkout=monthly";
const MOCK_SESSION_URL_ANNUAL = "/premium?mock-checkout=annual";

async function captureCheckoutRequestBody(route: Route): Promise<unknown> {
  const request = route.request();
  return request.postDataJSON();
}

test.describe("Premium page: checkout enabled", () => {
  test("Choose Monthly and Choose Annual are enabled for an authenticated user", async ({
    page,
  }) => {
    await page.goto("/premium");
    await expect(page.getByRole("button", { name: "Choose Monthly" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Choose Annual" })).toBeEnabled();
  });

  test("merely loading /premium still starts no Checkout Session", async ({ page }) => {
    const checkoutRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/billing/checkout")) checkoutRequests.push(req.url());
    });
    await page.goto("/premium");
    await page.waitForLoadState("networkidle");
    expect(checkoutRequests).toEqual([]);
  });

  test('clicking Choose Monthly sends only { plan: "monthly" } -- no priceId, customerId, or other client-controlled value', async ({
    page,
  }) => {
    let capturedBody: unknown;
    await page.route("**/api/billing/checkout", async (route) => {
      capturedBody = await captureCheckoutRequestBody(route);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: MOCK_SESSION_URL_MONTHLY }),
      });
    });

    await page.goto("/premium");
    await clickAndExpect(page.getByRole("button", { name: "Choose Monthly" }), () =>
      page.waitForURL(/mock-checkout=monthly/, { timeout: 5_000 }),
    );

    expect(capturedBody).toEqual({ plan: "monthly" });
  });

  test('clicking Choose Annual sends only { plan: "annual" }', async ({ page }) => {
    let capturedBody: unknown;
    await page.route("**/api/billing/checkout", async (route) => {
      capturedBody = await captureCheckoutRequestBody(route);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: MOCK_SESSION_URL_ANNUAL }),
      });
    });

    await page.goto("/premium");
    await clickAndExpect(page.getByRole("button", { name: "Choose Annual" }), () =>
      page.waitForURL(/mock-checkout=annual/, { timeout: 5_000 }),
    );

    expect(capturedBody).toEqual({ plan: "annual" });
  });

  test("both buttons disable immediately on click and stay disabled while the request is pending", async ({
    page,
  }) => {
    let releaseResponse: () => void = () => {};
    const responseHeld = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    let requestCount = 0;
    await page.route("**/api/billing/checkout", async (route) => {
      requestCount += 1;
      await responseHeld;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: MOCK_SESSION_URL_MONTHLY }),
      });
    });

    await page.goto("/premium");
    const monthlyBtn = page.getByRole("button", { name: "Choose Monthly" });
    const annualBtn = page.getByRole("button", { name: "Choose Annual" });
    // A retried click here (hydration race) would start a second pending
    // request -- harmless for this assertion (both buttons stay disabled
    // either way) and the still-open first mock response is released
    // below regardless of how many times the route fired.
    await clickAndExpect(monthlyBtn, () => expect(monthlyBtn).toBeDisabled({ timeout: 2_000 }));
    await expect(annualBtn).toBeDisabled();
    expect(requestCount).toBeGreaterThan(0);

    releaseResponse();
    await page.waitForURL(/mock-checkout=monthly/);
  });

  test("rapid repeated clicks on the same button create only one Checkout Session request", async ({
    page,
  }) => {
    let requestCount = 0;
    let releaseResponse: () => void = () => {};
    const responseHeld = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/billing/checkout", async (route) => {
      requestCount += 1;
      await responseHeld;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: MOCK_SESSION_URL_MONTHLY }),
      });
    });

    await page.goto("/premium");
    const monthlyBtn = page.getByRole("button", { name: "Choose Monthly" });
    // First confirm the click actually registered (retrying past the same
    // hydration race every other test here guards against) before firing
    // the extra rapid clicks this test is actually about -- otherwise a
    // swallowed first click would leave nothing pending for those extra
    // clicks to (correctly) fail to duplicate.
    await clickAndExpect(monthlyBtn, () =>
      expect.poll(() => requestCount, { timeout: 2_000 }).toBeGreaterThan(0),
    );
    // The button is disabled now (pending request), so these are expected
    // to be no-ops -- real browsers never dispatch click handlers for a
    // disabled control, which is exactly the behavior under test here.
    await monthlyBtn.click({ force: true }).catch(() => {});
    await monthlyBtn.click({ force: true }).catch(() => {});

    releaseResponse();
    await page.waitForURL(/mock-checkout=monthly/);

    expect(requestCount).toBe(1);
  });

  test("a failed Checkout Session request shows a safe, localized error and restores the button", async ({
    page,
  }) => {
    await page.route("**/api/billing/checkout", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Checkout is temporarily unavailable." }),
      });
    });

    await page.goto("/premium");
    const monthlyBtn = page.getByRole("button", { name: "Choose Monthly" });
    await clickAndExpect(monthlyBtn, () =>
      expect(page.getByText("Couldn't start checkout. Please try again.")).toBeVisible({
        timeout: 2_000,
      }),
    );

    await expect(monthlyBtn).toBeEnabled();
    await expect(page.getByRole("button", { name: "Choose Annual" })).toBeEnabled();
  });

  test("a network failure while starting checkout shows the same safe error and restores the button (never a raw error or stack trace)", async ({
    page,
  }) => {
    await page.route("**/api/billing/checkout", (route) => route.abort("failed"));

    await page.goto("/premium");
    const monthlyBtn = page.getByRole("button", { name: "Choose Monthly" });
    await clickAndExpect(monthlyBtn, () =>
      expect(page.getByText("Couldn't start checkout. Please try again.")).toBeVisible({
        timeout: 2_000,
      }),
    );

    await expect(monthlyBtn).toBeEnabled();
    // Never a raw stack trace or [object Object] leaking into the UI.
    await expect(page.getByText("TypeError", { exact: false })).not.toBeVisible();
  });

  test("an expired/missing session shows a sign-in message instead of a raw 401", async ({
    page,
  }) => {
    await page.route("**/api/billing/checkout", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Sign in required." }),
      });
    });

    await page.goto("/premium");
    const monthlyBtn = page.getByRole("button", { name: "Choose Monthly" });
    await clickAndExpect(monthlyBtn, () =>
      expect(page.getByText("Please sign in again to continue to checkout.")).toBeVisible({
        timeout: 2_000,
      }),
    );

    await expect(monthlyBtn).toBeEnabled();
  });

  test("a fully logged-out session (no Supabase session at all) also shows the sign-in message, not a raw error, and never reaches the network", async ({
    page,
  }) => {
    let checkoutRequestMade = false;
    await page.route("**/api/billing/checkout", (route) => {
      checkoutRequestMade = true;
      return route.continue();
    });

    await page.goto("/premium");
    // billingFetch (src/lib/billing/fetchClient.ts) throws synchronously,
    // before ever calling fetch(), when supabase.auth.getSession() finds no
    // session -- clearing storage reproduces that without needing a real
    // sign-out flow.
    await page.evaluate(() => localStorage.clear());

    const monthlyBtn = page.getByRole("button", { name: "Choose Monthly" });
    await clickAndExpect(monthlyBtn, () =>
      expect(page.getByText("Please sign in again to continue to checkout.")).toBeVisible({
        timeout: 2_000,
      }),
    );

    await expect(monthlyBtn).toBeEnabled();
    expect(checkoutRequestMade).toBe(false);
  });
});
