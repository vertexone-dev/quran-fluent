import { test, expect } from "@playwright/test";

/**
 * Sprint 4 (Android release polish) regression suite -- covers defects
 * found and fixed during the release audit that no existing spec exercised:
 * list rows that were click-handled <div>s (unreachable by keyboard/screen
 * reader), a handful of hardcoded-English strings that never translated to
 * French, and <html lang> never following the UI locale. See the sprint
 * report for the full defect list; this file only covers what's practical
 * to assert from Playwright.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
});

test.describe("Keyboard accessibility: list rows are real buttons", () => {
  test("a Settings row is a focusable, Enter-activatable <button>, not an inert div", async ({
    page,
  }) => {
    await page.getByTestId("profile-button").click(); // D-1: Profile & More
    await page.locator(".list-row", { hasText: "Settings" }).click();
    await expect(page.locator(".appbar-title")).toHaveText("Settings");

    const languageRow = page.getByTestId("settings-language-row");
    await expect(languageRow).toBeVisible();
    const before = await languageRow.locator(".text-muted").textContent();

    await languageRow.focus();
    await expect(languageRow).toBeFocused();
    await page.keyboard.press("Enter");

    const after = await languageRow.locator(".text-muted").textContent();
    expect(after).not.toBe(before);
  });

  test("a Lessons level row and a Surah List row are both real buttons", async ({ page }) => {
    await page.locator(".tab-item", { hasText: "Learn" }).click();
    await expect(page.locator("button.list-row").first()).toBeVisible();

    await page.locator(".tab-item", { hasText: "Qur'an" }).click();
    // The surah name/number area is the button; the Arabic name and the
    // favorite star are its siblings, not nested inside it.
    await expect(page.locator("button", { hasText: "Al-Fatiha" }).first()).toBeVisible();
  });
});

test.describe("French translations: no hardcoded English left", () => {
  test("Offline Access screen is fully translated in French, not just its heading", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Language" }).click();

    await page.getByTestId("profile-button").click(); // D-1: Profil et plus
    await page.locator(".list-row", { hasText: "Accès hors ligne" }).click();
    await expect(page.locator(".appbar-title")).toHaveText("Accès hors ligne");

    await expect(page.getByText("Coran arabe", { exact: false })).toBeVisible();
    await expect(page.getByText("Traduction anglaise (Pickthall)")).toBeVisible();
    await expect(page.getByText("Traduction française (Kazimirski)")).toBeVisible();
    await expect(page.getByText("Exercices", { exact: true })).toBeVisible();

    await expect(page.getByText("English Translation (Pickthall)")).toHaveCount(0);
    await expect(page.getByText("French Translation (Kazimirski)")).toHaveCount(0);
    await expect(page.getByText("Exercises", { exact: true })).toHaveCount(0);
  });

  test("a surah's favorite toggle has a translated, state-dependent accessible name", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Language" }).click();
    await page.locator(".tab-item", { hasText: "Coran" }).click();

    const favoriteButton = page.locator(".list-row").first().locator("button").last();
    await expect(favoriteButton).toHaveAttribute("aria-label", "Ajouter aux favoris");
    await favoriteButton.click();
    await expect(favoriteButton).toHaveAttribute("aria-label", "Retirer des favoris");
  });
});

test.describe("Document language", () => {
  test("<html lang> follows the UI locale switch, for correct screen-reader pronunciation", async ({
    page,
  }) => {
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByRole("button", { name: "Language" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });
});

test.describe("Content-load error state", () => {
  test("shows a real, translated error message instead of a blank screen when bundled content fails to load", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("qr.settings.locale", JSON.stringify("fr"));
    });
    await page.route("**/sql-wasm.wasm", (route) => route.abort());
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Échec du chargement du contenu hors ligne" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Theme default and persistence", () => {
  // Pinned so resolveIsDark's "system" branch is deterministic here --
  // without it, a "system" preference's resolved light/dark state would
  // depend on whatever color scheme the test runner's OS happens to be in.
  test.use({ colorScheme: "light" });

  test("a brand-new install defaults to Midnight (dark), not System (QR-DESIGN-002)", async ({
    page,
  }) => {
    await expect(page.locator("html")).toHaveClass(/dark/);
    // The toggle's accessible name previews the *next* theme it will
    // switch to; "System" next confirms the current state is Midnight.
    await expect(page.getByRole("button", { name: "Theme: System" })).toBeVisible();
  });

  test("an existing saved Dark preference is preserved", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("qr.settings.theme", JSON.stringify("dark"));
    });
    await page.goto("/");
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Theme: System" })).toBeVisible();
  });

  test("an existing saved Light (Ivory) preference is preserved, not reset to Midnight", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("qr.settings.theme", JSON.stringify("light"));
    });
    await page.goto("/");
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });

    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
  });

  test("an existing saved System preference is preserved", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("qr.settings.theme", JSON.stringify("system"));
    });
    await page.goto("/");
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });

    // Resolves to Light here only because the OS preference is pinned light
    // above -- proving Match device is still a live, working choice.
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Theme: Light" })).toBeVisible();
  });

  test("switching the theme in Settings persists across a reload", async ({ page }) => {
    await page.getByTestId("tab-settings").click();
    const select = page.getByTestId("setting-theme");
    await expect(select).toHaveValue("dark");
    await select.selectOption("light");
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    await page.reload();
    await page.getByTestId("tab-settings").click();
    await expect(page.getByTestId("setting-theme")).toHaveValue("light");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
