import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Validates the app against the real, live 114-surah / 6,236-ayah import —
 * no route mocking, no 7-surah bootstrap assumption. Read-only checks use
 * a handful of non-bootstrap Surahs (2, 18, 55); write checks use Al-Fil
 * (105), a short new Surah untouched by every other spec, cleaned up
 * before/after so reruns start from a known state.
 */
test.describe("full 114-surah dataset", () => {
  test("Surah picker lists all 114 Surahs, not just the original 7-surah bootstrap set", async ({
    page,
  }) => {
    await page.goto("/quran");
    await page.waitForLoadState("networkidle");
    const trigger = page.getByLabel("Select a Surah");
    // The trigger can render before its dropdown is fully interactive under
    // load; retry the click rather than assume the first one always opens
    // a 114-item listbox.
    await expect(async () => {
      await trigger.click();
      await expect(page.getByRole("option").first()).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(page.getByRole("option")).toHaveCount(114);
  });

  test("opening several non-bootstrap Surahs renders real Arabic text", async ({ page }) => {
    for (const surah of [2, 18, 55]) {
      await page.goto(`/quran?surah=${surah}`);
      const arabic = page.locator('[lang="ar"][dir="rtl"]').first();
      await expect(arabic).toBeVisible();
      expect((await arabic.innerText()).trim().length).toBeGreaterThan(0);
    }
  });

  test("shows the translation-unavailable fallback for a real new Ayah, and never the literal word null", async ({
    page,
  }) => {
    await page.goto("/quran?surah=2");
    await expect(
      page.getByText("English translation not available yet for this Ayah.").first(),
    ).toBeVisible();

    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);
  });

  test("existing translated bootstrap Ayah still shows its real translation (regression)", async ({
    page,
  }) => {
    await page.goto("/quran?surah=1");
    await expect(page.getByText(/In the name of Allah/)).toBeVisible();
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toContain("translation not available yet");
  });

  test("bookmarks, notes and memorization all work on a real Arabic-only Ayah; review scheduling gracefully skips", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("bookmarks").delete().eq("user_id", userId).eq("surah_number", 105);
    await client.from("notes").delete().eq("user_id", userId).eq("surah_number", 105);
    await client
      .from("memorization_progress")
      .delete()
      .eq("user_id", userId)
      .eq("surah_number", 105);
    await client
      .from("review_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_type", "ayah")
      .eq("item_key", "ayah:105:1");

    await page.goto("/quran?surah=105");
    const card = page.locator("#ayah-105-1");

    await card.getByRole("button", { name: "Bookmark Ayah" }).click();
    await expect(card.getByRole("button", { name: "Remove Bookmark" })).toBeVisible();

    await card.getByRole("button", { name: "Add Note" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox").fill("Note on a real Arabic-only Ayah (105:1).");
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/rest/v1/notes") && res.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Save" }).click(),
    ]);

    await expect
      .poll(async () => {
        const { count } = await client
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("surah_number", 105)
          .eq("ayah_number", 1);
        return count;
      })
      .toBe(1);
    await expect
      .poll(async () => {
        const { count } = await client
          .from("notes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("surah_number", 105)
          .eq("ayah_number", 1);
        return count;
      })
      .toBe(1);

    await page.goto("/memorize?surah=105&ayah=1");
    await expect(page.getByText("Ayah 1")).toBeVisible();
    await page.getByRole("button", { name: "Mark as memorized" }).click();
    await expect(
      page.getByText(
        "Marked as memorized. Review reminders will start once a translation is available for this Ayah.",
      ),
    ).toBeVisible();

    await expect
      .poll(async () => {
        const { data } = await client
          .from("memorization_progress")
          .select("status")
          .eq("user_id", userId)
          .eq("surah_number", 105)
          .eq("ayah_number", 1)
          .maybeSingle();
        return data?.status;
      })
      .toBe("memorized");

    const { count: reviewCount } = await client
      .from("review_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("item_type", "ayah")
      .eq("item_key", "ayah:105:1");
    expect(reviewCount).toBe(0);
  });

  test("EN/FR UI stays stable when reading a non-bootstrap Surah", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);

    await page.goto("/quran?surah=18");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    const arabic = page.locator('[lang="ar"][dir="rtl"]').first();
    await expect(arabic).toBeVisible();
    const bodyText = await page.locator("main").innerText();
    expect(bodyText).not.toMatch(/\bnull\b/);

    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
  });
});
