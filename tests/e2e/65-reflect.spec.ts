import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

// Al-Fatiha ayah 2 -- light to render (7 ayahs total) and distinct from the
// ayahs other specs already write notes to (11-notes.spec.ts uses 1:1 for
// both its happy-path and XSS cases).
const TEST_SURAH = 1;
const TEST_AYAH = 2;

test.describe("reflect", () => {
  test.beforeEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("notes")
      .delete()
      .eq("user_id", userId)
      .eq("surah_number", TEST_SURAH)
      .eq("ayah_number", TEST_AYAH);
  });

  test("shows a guidance empty state when no ayah has been selected, never a demo ayah", async ({
    page,
  }) => {
    await page.goto("/reflect");
    await expect(page.getByText("Choose an ayah to reflect on")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the Qur'an Reader" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View all your notes" })).toBeVisible();
    // QR-INT-003 explicitly forbids a hardcoded demo ayah as real context.
    await expect(page.getByTestId("reflection-ayah-badge")).toHaveCount(0);
  });

  test("arriving from the Quran Reader opens Reflect on the selected ayah", async ({ page }) => {
    await page.goto(`/quran?surah=${TEST_SURAH}`);
    await page
      .locator(`#ayah-${TEST_SURAH}-${TEST_AYAH}`)
      .getByRole("link", { name: "Reflect" })
      .click();

    await expect(page).toHaveURL(/\/reflect/);
    await expect(page.getByTestId("reflection-ayah-badge")).toContainText(
      `${TEST_SURAH}:${TEST_AYAH}`,
    );
  });

  test("selecting a prompt swaps the reflection question, and toggling it off restores the default", async ({
    page,
  }) => {
    await page.goto(`/reflect?surah=${TEST_SURAH}&ayah=${TEST_AYAH}`);
    const question = page.getByTestId("reflection-question");

    await expect(question).toHaveText("How does this verse speak to my life today?");

    await page.getByTestId("reflection-prompt-0").click();
    await expect(question).toHaveText(
      "What blessing does this ayah remind you to be grateful for?",
    );

    await page.getByTestId("reflection-prompt-0").click();
    await expect(question).toHaveText("How does this verse speak to my life today?");
  });

  test("saving a reflection persists it via the real notes service, and it shows up on /notes too", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto(`/reflect?surah=${TEST_SURAH}&ayah=${TEST_AYAH}`);
    await page.getByTestId("reflection-prompt-1").click();
    await page.getByTestId("reflection-textarea").fill("A reflection on patience from this ayah.");
    await page.getByTestId("reflection-save-button").click();

    await expect
      .poll(async () => {
        const { data } = await client
          .from("notes")
          .select("content")
          .eq("user_id", userId)
          .eq("surah_number", TEST_SURAH)
          .eq("ayah_number", TEST_AYAH);
        return data?.[0]?.content;
      })
      .toBe("A reflection on patience from this ayah.");

    await expect(page.getByTestId("notes-list")).toContainText(
      "A reflection on patience from this ayah.",
    );

    await page.goto("/notes");
    await expect(page.getByText("A reflection on patience from this ayah.")).toBeVisible();
  });

  test("editing and deleting a reflection works, and the empty state returns", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("notes").insert({
      user_id: userId,
      surah_number: TEST_SURAH,
      ayah_number: TEST_AYAH,
      content: "Original reflection text.",
    });

    await page.goto(`/reflect?surah=${TEST_SURAH}&ayah=${TEST_AYAH}`);
    await expect(page.getByText("Original reflection text.")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    const textarea = dialog.getByRole("textbox");
    await textarea.fill("");
    await textarea.fill("Edited reflection text.");
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/rest/v1/notes") && res.request().method() === "PATCH",
      ),
      dialog.getByRole("button", { name: "Save" }).click(),
    ]);
    await expect(page.getByText("Edited reflection text.")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).last().click();
    await expect(
      page.getByText("Your saved reflections on this ayah will appear here."),
    ).toBeVisible();

    const { count } = await client
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("surah_number", TEST_SURAH)
      .eq("ayah_number", TEST_AYAH);
    expect(count).toBe(0);
  });

  test("a failed load shows an error state, not an empty list", async ({ page }) => {
    test.setTimeout(30_000);
    await page.route("**/rest/v1/notes*", (route) => route.abort("failed"));

    await page.goto(`/reflect?surah=${TEST_SURAH}&ayah=${TEST_AYAH}`);
    await expect(page.getByText("Couldn't load your reflections.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("Your saved reflections on this ayah will appear here."),
    ).toHaveCount(0);
  });

  test("reflection content is rendered as plain text, never as HTML", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("notes").insert({
      user_id: userId,
      surah_number: TEST_SURAH,
      ayah_number: TEST_AYAH,
      content: "<img src=x onerror=alert(1)>not-a-script",
    });

    let alertFired = false;
    page.on("dialog", async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto(`/reflect?surah=${TEST_SURAH}&ayah=${TEST_AYAH}`);
    await expect(page.getByText("not-a-script")).toBeVisible();
    expect(await page.locator("main img[src='x']").count()).toBe(0);
    expect(alertFired).toBe(false);
  });

  test("Reflect is reachable from the desktop nav", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Reflect" })
      .click();
    await expect(page).toHaveURL(/\/reflect/);
  });

  test("Reflect is reachable from the mobile navigation drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Reflect" }).click();
    await expect(page).toHaveURL(/\/reflect/);
  });

  // QR-INT-003: the authenticated, profile-persisted locale path (as
  // opposed to the anonymous localStorage-only path 64-arabic-rtl.spec.ts
  // covers) -- same try/finally restore-to-"en" discipline as
  // 57-settings.spec.ts's equivalent Arabic case, since this is the shared
  // test account every other authenticated spec also reads.
  test("renders in Arabic with rtl layout and translated prompts when the saved profile language is ar", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "ar" }).eq("id", userId);

    try {
      await page.goto(`/reflect?surah=${TEST_SURAH}&ayah=${TEST_AYAH}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "ar");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      await expect(page.getByRole("heading", { name: "تدبّر", exact: true })).toBeVisible();

      await page.getByTestId("reflection-prompt-0").click();
      await expect(page.getByTestId("reflection-question")).toHaveText(
        "ما النعمة التي تذكّرك هذه الآية بشكرها؟",
      );
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });
});
