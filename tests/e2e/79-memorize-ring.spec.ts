import { expect, test } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

// QR-DESIGN-008B: the Memorize progress ring is drawn only from the learner's real
// records (memorization_progress + review_items). See src/lib/memorization-progress.ts.

test.beforeEach(async () => {
  const { client, userId } = await createTestUserClient();
  await client
    .from("learning_preferences")
    .update({ onboarding_completed: true })
    .eq("user_id", userId);
  await client.from("memorization_progress").delete().eq("user_id", userId);
  await client.from("review_items").delete().eq("user_id", userId).eq("item_type", "ayah");
});

async function setProfileLanguage(lang: string) {
  const { client, userId } = await createTestUserClient();
  const { error } = await client
    .from("profiles")
    .update({ interface_language: lang })
    .eq("id", userId);
  if (error) throw new Error(`Failed to set the profile language: ${error.message}`);
}

test.afterEach(async () => {
  await setProfileLanguage("en");
});

test.describe("Memorize progress ring", () => {
  test("with no records it shows an honest empty state and an empty ring", async ({ page }) => {
    await page.goto("/memorize");
    const card = page.getByTestId("memorize-ring-card");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("memorize-ring-empty")).toContainText("Nothing is estimated");
    const ring = page.getByTestId("memorize-ring");
    await expect(ring).toHaveAttribute("data-memorized", "0");
    await expect(ring).toHaveAttribute("data-learning", "0");
    await expect(ring).toHaveAttribute("aria-label", "No memorization progress yet.");
    await expect(page.getByTestId("memorize-ring-percent")).toHaveText("0%");
  });

  test("shows the real counts, separates memorized from learning, and exposes them as text", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    const rows = [
      ...[1, 2, 3].map((n) => ({
        user_id: userId,
        surah_number: 1,
        ayah_number: n,
        status: "memorized" as const,
        memorized_at: new Date().toISOString(),
      })),
      { user_id: userId, surah_number: 1, ayah_number: 4, status: "learning" as const },
      { user_id: userId, surah_number: 1, ayah_number: 5, status: "learning" as const },
    ];
    const { error } = await client.from("memorization_progress").insert(rows);
    expect(error).toBeNull();
    // Two review items due (one for a memorized, one for a learning ayah) and one not due.
    // Far enough either side of "today" that the UTC date used here and the learner's
    // local date used by the app cannot disagree about which are due.
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const today = day(-3);
    const future = day(5);
    const item = (n: number, due: string) => ({
      user_id: userId,
      item_type: "ayah",
      item_key: `ayah:1:${n}`,
      front: "x",
      back: "y",
      context: `1:${n}`,
      due_date: due,
    });
    const ri = await client
      .from("review_items")
      .insert([item(1, today), item(4, today), item(2, future)]);
    expect(ri.error).toBeNull();

    await page.goto("/memorize");
    const ring = page.getByTestId("memorize-ring");
    await expect(ring).toHaveAttribute("data-memorized", "3");
    await expect(ring).toHaveAttribute("data-learning", "2");
    await expect(ring).toHaveAttribute("data-total", "7");
    // 3 of 7 = 42%
    await expect(page.getByTestId("memorize-ring-percent")).toHaveText("42%");
    await expect(page.getByTestId("memorize-ring-summary")).toContainText("3 of 7 Ayat memorized");
    await expect(ring).toHaveAttribute(
      "aria-label",
      /3 of 7 Ayat memorized, 2 learning, 2 due for revision/,
    );
    const card = page.getByTestId("memorize-ring-card");
    // The visible legend carries every number, so the ring is never the only source.
    for (const [label, n] of [
      ["Memorized", "3"],
      ["Learning", "2"],
      ["Due for revision", "2"],
      ["Not started", "2"],
    ] as const) {
      await expect(
        card.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]"),
      ).toHaveText(n);
    }
    // The method is documented on the page.
    await card.getByText("How this is calculated").click();
    await expect(card).toContainText("memorized Ayat divided by the Surah's Ayat");
  });

  test("tracks the most recently started Surah, and updates after memorizing", async ({ page }) => {
    await page.goto("/memorize?surah=1&ayah=1");
    await page.getByRole("button", { name: "Mark as memorized" }).click();
    // Wait for the write itself (the button's own label also contains "memorized",
    // so it is not a signal), then leave the page.
    const { client, userId } = await createTestUserClient();
    await expect
      .poll(async () => {
        const { data } = await client
          .from("memorization_progress")
          .select("status")
          .eq("user_id", userId)
          .eq("surah_number", 1)
          .eq("ayah_number", 1)
          .maybeSingle();
        return data?.status;
      })
      .toBe("memorized");
    await page.goto("/memorize");
    const ring = page.getByTestId("memorize-ring");
    await expect(ring).toHaveAttribute("data-memorized", "1");
    await expect(ring).toHaveAttribute("data-total", "7");
    await expect(page.getByTestId("memorize-ring-percent")).toHaveText("14%");
  });

  test("renders in French and Arabic with translated legend and a text alternative", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("memorization_progress").insert({
      user_id: userId,
      surah_number: 1,
      ayah_number: 1,
      status: "learning",
    });
    for (const [lang, learning] of [
      ["fr", "En cours"],
      ["ar", "قيد الحفظ"],
    ] as const) {
      await setProfileLanguage(lang);
      await page.goto("/memorize");
      await expect(page.getByTestId("memorize-ring-card")).toContainText(learning);
      await expect(page.getByTestId("memorize-ring")).toHaveAttribute("aria-label", /.+/);
    }
  });
});
