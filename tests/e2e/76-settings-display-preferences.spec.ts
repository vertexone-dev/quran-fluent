import { test, expect, type Page } from "@playwright/test";

import { countRows, createTestUserClient } from "./utils/db";

/**
 * Display preferences (text size, reduced motion, start screen, export, reset)
 * are device-local. This spec proves both halves of that claim against the
 * isolated LOCAL stack the whole e2e suite already uses:
 *   1. each control does what it says, and
 *   2. using them never touches the account: no write request is sent to the
 *      API, auth or billing, and the account's bookmarks, notes, lesson
 *      progress, memorization, streaks, learning preferences and profile are
 *      identical before and after.
 * Nothing here talks to production: playwright.config / ci.yml refuse non-local
 * targets before any spec runs.
 */

const USER_TABLES = [
  "bookmarks",
  "notes",
  "user_lesson_progress",
  "memorization_progress",
] as const;

async function accountSnapshot() {
  const { client, userId } = await createTestUserClient();
  const counts: Record<string, number> = {};
  for (const table of USER_TABLES) counts[table] = await countRows(client, table, userId);
  const streak = await client.from("streaks").select("*").eq("user_id", userId).maybeSingle();
  const prefs = await client
    .from("learning_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  // updated_at style columns must not move either, so compare whole rows.
  return { counts, streak: streak.data, prefs: prefs.data, profile: profile.data };
}

async function choose(page: Page, triggerTestId: string, optionName: string) {
  await page.getByTestId(triggerTestId).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

test.describe("Settings display preferences", () => {
  test("work, and never touch the account", async ({ page }) => {
    const sideEffects: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      const writes =
        req.method() !== "GET" && req.method() !== "HEAD" && req.method() !== "OPTIONS";
      if (
        writes &&
        /\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\/|stripe|checkout|billing/i.test(url)
      ) {
        sideEffects.push(`${req.method()} ${url}`);
      }
    });

    const before = await accountSnapshot();

    await page.goto("/settings");
    await expect(page.getByTestId("settings-appearance-card")).toBeVisible({ timeout: 15_000 });
    const html = page.locator("html");

    // --- text size: small / large change the root size, medium restores it
    await choose(page, "settings-text-size", "Large");
    await expect(html).toHaveAttribute("data-qr-text", "large");
    await expect.poll(() => html.evaluate((el) => el.style.fontSize)).toBe("112.5%");
    await choose(page, "settings-text-size", "Small");
    await expect.poll(() => html.evaluate((el) => el.style.fontSize)).toBe("93.75%");

    // --- reduced motion toggles the document flag, and survives a reload
    await page.getByTestId("settings-reduce-motion").click();
    await expect(html).toHaveAttribute("data-qr-motion", "reduce");
    await page.reload();
    await expect(page.getByTestId("settings-appearance-card")).toBeVisible({ timeout: 15_000 });
    await expect(html).toHaveAttribute("data-qr-motion", "reduce");
    await expect(html).toHaveAttribute("data-qr-text", "small");

    // --- start screen: opens the chosen screen once per browser session
    await choose(page, "settings-start-screen", "Qur'an");
    await page.evaluate(() => window.sessionStorage.clear());
    await page.goto("/");
    await expect(page).toHaveURL(/\/quran/, { timeout: 15_000 });
    // ...and only once: Home stays Home for the rest of the session.
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/quran/);

    // --- export: a preferences-only file
    await page.goto("/settings");
    await expect(page.getByTestId("settings-preferences-card")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("settings-export-preferences").click(),
    ]);
    expect(download.suggestedFilename()).toBe("quranroots-preferences.json");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");
    const exported = JSON.parse(text);
    expect(exported).toMatchObject({
      app: "QuranRoots",
      kind: "preferences",
      preferences: { textSize: "small", reduceMotion: true, startScreen: "quran" },
    });
    for (const secret of ["token", "email", "password", "bookmark", "note", "progress"]) {
      expect(text.toLowerCase()).not.toContain(secret);
    }

    // --- reset: asks first, then restores defaults
    await page.getByTestId("settings-reset-preferences").click();
    await page.getByTestId("settings-reset-confirm").click();
    await expect(html).toHaveAttribute("data-qr-text", "medium");
    await expect(html).toHaveAttribute("data-qr-motion", "full");
    await expect.poll(() => html.evaluate((el) => el.style.fontSize)).toBe("100%");
    await expect(page).toHaveURL(/\/settings/); // still signed in

    // --- nothing reached the account
    expect(sideEffects, `unexpected write requests:\n${sideEffects.join("\n")}`).toEqual([]);
    expect(await accountSnapshot()).toEqual(before);
  });
});
