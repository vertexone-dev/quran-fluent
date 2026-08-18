import { test as setup, expect } from "@playwright/test";
import path from "node:path";

import { createTestUserClient, resetTestUserData } from "../utils/db";

const authFile = path.join(__dirname, "../../../playwright/.auth/user.json");

setup("reset test account data and sign in", async ({ page }) => {
  const { client, userId } = await createTestUserClient();
  await resetTestUserData(client, userId);
  await client.auth.signOut();

  await page.goto("/auth?mode=login");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Log in" }).click();

  // Login always navigates to /dashboard; a client-side effect then bounces
  // to /onboarding when onboarding_completed is false (it is, post-reset).
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  await page.context().storageState({ path: authFile });
});
