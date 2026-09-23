import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Regression coverage for a production routing defect: `/settings/billing`
 * resolved (correct document title, "Billing — QuranRoots") but rendered
 * the *general* Settings page (Profile/Learning/Appearance/Account) instead
 * of the dedicated billing component.
 *
 * ROOT CAUSE: `settings.billing.tsx` is wired in src/routeTree.gen.ts as a
 * genuine TanStack Router *child* of `settings.tsx`
 * (`getParentRoute`/`_addFileChildren`), but `settings.tsx`'s own component
 * rendered the full general-settings page directly with no `<Outlet />`
 * anywhere -- so the child route's component had nowhere to mount. Route
 * `head()` metadata resolves per matched route independent of component
 * rendering, which is exactly why the title/heading looked right while the
 * wrong body rendered.
 *
 * FIX: settings.tsx is now a pure layout (`<Outlet />` only); the original
 * general-settings page moved unchanged to settings.index.tsx (the
 * `/settings/` index child). This file's own first two tests would have
 * FAILED against the pre-fix deployed behavior (the "Profile" card would
 * have been visible on /settings/billing, and the heading would have read
 * "Settings" instead of "Billing").
 */

test.describe("Settings / Billing routing", () => {
  test.afterEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
  });

  test("an authenticated visit to /settings renders the general Settings page", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(page.getByText("Profile", { exact: true })).toBeVisible();
    await expect(page.getByLabel("First name")).toBeVisible();
  });

  test("an authenticated visit to /settings/billing renders the dedicated billing interface, not the general profile form", async ({
    page,
  }) => {
    await page.goto("/settings/billing");
    await expect(page.getByRole("heading", { name: "Billing", level: 1 })).toBeVisible();

    // The specific regression: the general Settings page's own "Profile"
    // section/first-name field must NOT be present here.
    await expect(page.getByText("Profile", { exact: true })).not.toBeVisible();
    await expect(page.getByLabel("First name")).not.toBeVisible();

    // Billing-specific content actually rendered -- proves the billing
    // route's component mounted and its GET /api/billing/status call
    // resolved successfully (a stuck loading/error state would show
    // neither of these).
    await expect(page.getByText("being prepared", { exact: false })).toBeVisible();
    await expect(page.getByText("Free plan", { exact: false })).toBeVisible();
  });

  test("/settings/billing's billing-status request succeeds and reflects the account's real (no-subscription) state", async ({
    page,
  }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/billing/status") && res.request().method() === "GET",
    );
    await page.goto("/settings/billing");
    const response = await responsePromise;
    expect(response.status()).toBe(200);

    const body = (await response.json()) as {
      hasSubscription: boolean;
      enforcementEnabled: boolean;
    };
    expect(body.enforcementEnabled).toBe(false);
    // The shared E2E account has no billing_subscriptions row in this
    // environment -- the page must show the Free/no-subscription state,
    // never a stale/blank one.
    if (!body.hasSubscription) {
      await expect(page.getByText("Free plan", { exact: false })).toBeVisible();
    }
  });

  test("checkout controls stay disabled while VITE_BILLING_CHECKOUT_ENABLED is false, and loading /premium makes no live Stripe request", async ({
    page,
  }) => {
    const stripeRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("stripe.com")) stripeRequests.push(req.url());
    });

    await page.goto("/premium");
    await expect(page.getByRole("button", { name: "Choose Monthly" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Choose Annual" })).toBeDisabled();

    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    expect(stripeRequests).toEqual([]);
  });

  // Unauthenticated access to /settings/billing is covered by
  // security.spec.ts's PROTECTED_ROUTES table (runs in the storageState-free
  // "public" project, the app's established pattern for this kind of
  // assertion) rather than duplicated here.

  test("renders correctly in French", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    await page.goto("/settings/billing");
    await expect(page.getByRole("heading", { name: "Facturation", level: 1 })).toBeVisible();
    await expect(page.getByText("en préparation", { exact: false })).toBeVisible();
    await expect(page.getByText("offre Gratuite", { exact: false })).toBeVisible();

    // Same regression guard as the English test, in French: the general
    // Settings page's own content must not leak through here either.
    await expect(page.getByText("Profile", { exact: true })).not.toBeVisible();
  });
});
