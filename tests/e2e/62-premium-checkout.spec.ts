import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Regression coverage for controlled checkout enablement, run against this
 * repo's default (and production's actual current) state:
 * VITE_BILLING_CHECKOUT_ENABLED unset/false. The companion "flag=true"
 * behavior (buttons enabled, clicking sends only the allowed plan
 * identifier, pending/duplicate-click/error handling) lives in
 * 63-checkout-enabled-flow.spec.ts, which runs against a second local dev
 * server built with the flag on (see playwright.config.ts) -- the flag is
 * compiled into the client bundle by Vite, so it cannot be flipped
 * mid-test against this server.
 */

test.describe("Premium page: checkout disabled by default", () => {
  test.afterEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
  });

  test("Choose Monthly and Choose Annual are disabled, and merely loading /premium starts no Checkout Session", async ({
    page,
  }) => {
    const checkoutRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/billing/checkout")) checkoutRequests.push(req.url());
    });

    await page.goto("/premium");
    await expect(page.getByRole("button", { name: "Choose Monthly" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Choose Annual" })).toBeDisabled();
    await page.waitForLoadState("networkidle");

    expect(checkoutRequests).toEqual([]);
  });

  test("merely loading /settings/billing (the other checkout entry point) starts no Checkout Session either", async ({
    page,
  }) => {
    const checkoutRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/billing/checkout")) checkoutRequests.push(req.url());
    });

    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    expect(checkoutRequests).toEqual([]);
  });

  test("renders correct English pricing content", async ({ page }) => {
    await page.goto("/premium");
    await expect(
      page.getByRole("heading", { name: "Study the full Qur'an curriculum, at your own pace." }),
    ).toBeVisible();
    await expect(page.getByText("Payments are being prepared.")).toBeVisible();
    await expect(page.getByText("$3.99", { exact: false })).toBeVisible();
    await expect(page.getByText("$29.99", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose Monthly" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose Annual" })).toBeVisible();
  });

  test("renders correct French pricing content", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    await page.goto("/premium");
    await expect(
      page.getByRole("heading", {
        name: "Étudiez le programme complet du Coran, à votre rythme.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Les paiements sont en préparation.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Choisir Mensuel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choisir Annuel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choisir Mensuel" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Choisir Annuel" })).toBeDisabled();
  });
});
