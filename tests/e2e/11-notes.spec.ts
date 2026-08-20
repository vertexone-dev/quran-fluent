import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("notes", () => {
  test("adding a note persists across reload, can be edited, and can be deleted", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("notes").delete().eq("user_id", userId);

    await page.goto("/quran?surah=1");
    await page.getByRole("button", { name: "Add Note" }).first().click();

    // Scoped to the open dialog: the "Add Note" label is shared by every
    // per-ayah toolbar button on the page, so an unscoped getByLabel would
    // match those too, not just the dialog's textarea.
    const dialog = page.getByRole("dialog");
    const textarea = dialog.getByRole("textbox");
    await textarea.fill("My first study note on Al-Fatiha.");
    await page.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const { data } = await client.from("notes").select("content").eq("user_id", userId);
        return data?.[0]?.content;
      })
      .toBe("My first study note on Al-Fatiha.");

    await page.goto("/notes");
    await expect(page.getByText("My first study note on Al-Fatiha.")).toBeVisible();

    await page.getByRole("button", { name: "Edit Note" }).click();
    const editDialog = page.getByRole("dialog");
    const editTextarea = editDialog.getByRole("textbox");
    await editTextarea.fill("");
    await editTextarea.fill("An edited note on Al-Fatiha.");
    // Wait for the actual PATCH round-trip, not just the click event: a
    // bare .click() resolves as soon as the event dispatches, before
    // handleSave's async updateNote() call has necessarily started, let
    // alone finished. Asserting on UI text alone was intermittently racing
    // ahead of the network request under load (observed failing while the
    // PATCH simply hadn't fired yet by the time the assertion polled).
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/rest/v1/notes") && res.request().method() === "PATCH",
      ),
      page.getByRole("button", { name: "Save" }).click(),
    ]);

    await expect(page.getByText("An edited note on Al-Fatiha.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("An edited note on Al-Fatiha.")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).last().click();
    await expect(page.getByText("No notes yet.")).toBeVisible();

    const { count } = await client
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(0);
  });

  test("note content is rendered as plain text, never as HTML", async ({ page }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("notes").delete().eq("user_id", userId);
    await client.from("notes").insert({
      user_id: userId,
      surah_number: 1,
      ayah_number: 1,
      content: "<img src=x onerror=alert(1)>not-a-script",
    });

    let alertFired = false;
    page.on("dialog", async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto("/notes");
    await expect(page.getByText("not-a-script")).toBeVisible();
    // The tag must show up as literal text, not be parsed into a live <img>.
    expect(await page.locator("main img[src='x']").count()).toBe(0);
    expect(alertFired).toBe(false);
  });
});
