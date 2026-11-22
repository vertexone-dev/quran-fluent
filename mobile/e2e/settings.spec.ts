import { test, expect, type Page } from "@playwright/test";

/**
 * QR-DESIGN-002 Stage 2: Midnight / Ivory Light / Match device, interface
 * text size, reduced motion, start screen, preference export and reset.
 */

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}
async function openSettings(page: Page) {
  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("settings-screen")).toBeVisible();
}

test.describe("Settings (Design Lock v1.0)", () => {
  test.use({ colorScheme: "light" });
  test.beforeEach(async ({ page }) => boot(page));

  test("theme choices are named Midnight, Ivory Light and Match device", async ({ page }) => {
    await openSettings(page);
    const options = page.getByTestId("setting-theme").locator("option");
    await expect(options).toHaveText(["Midnight", "Ivory Light", "Match device"]);
    await expect(page.getByTestId("setting-theme")).toHaveValue("dark");
  });

  test("Match device follows the OS colour scheme", async ({ page }) => {
    await openSettings(page);
    await page.getByTestId("setting-theme").selectOption("system");
    await expect(page.locator("html")).not.toHaveClass(/dark/); // OS pinned light
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("text size scales the interface and persists", async ({ page }) => {
    const rootPx = () =>
      page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const base = await rootPx();
    await openSettings(page);
    await page.getByTestId("setting-text-size").selectOption("large");
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
    expect(await rootPx()).toBeGreaterThan(base);
    await page.getByTestId("setting-text-size").selectOption("small");
    expect(await rootPx()).toBeLessThan(base);
    await page.getByTestId("setting-text-size").selectOption("large");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  });

  test("reduce motion toggles an in-app class, is a real switch, and persists", async ({
    page,
  }) => {
    await openSettings(page);
    const sw = page.getByTestId("setting-reduce-motion");
    await expect(sw).toHaveAttribute("role", "switch");
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).toHaveClass(/reduce-motion/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/reduce-motion/);
  });

  test("reduce motion keeps the entrance animation (instant), never removes it", async ({
    page,
  }) => {
    // Regression: `animation: none` corrupted Home rendering in the Android
    // WebView. The animation must stay attached, with a ~zero duration.
    await openSettings(page);
    await page.getByTestId("setting-reduce-motion").click();
    await page.getByTestId("tab-home").click();
    const style = await page
      .locator(".stagger > *")
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { name: cs.animationName, duration: parseFloat(cs.animationDuration) };
      });
    expect(style.name).not.toBe("none");
    expect(style.duration).toBeLessThan(0.001);
  });

  test("start screen: Qur'an opens the surah list on launch", async ({ page }) => {
    await openSettings(page);
    await page.getByTestId("setting-start-screen").selectOption("quran");
    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("Surahs", { timeout: 15_000 });
    await expect(page.locator(".tab-item.active")).toContainText("Qur'an");
  });

  test("start screen: Continue reading opens the saved position, and back returns Home", async ({
    page,
  }) => {
    await page.getByTestId("tab-quran").click();
    await page.locator(".list-row").nth(1).click(); // Al-Baqara, records a reading position
    await expect(page.locator("h1")).toHaveText("Al-Baqara");
    await page.goto("/");
    await openSettings(page);
    await page.getByTestId("setting-start-screen").selectOption("continue");
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Al-Baqara", { timeout: 15_000 });
    await page.goBack();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots");
  });

  test("start screen: Continue reading with no saved position stays on Home", async ({ page }) => {
    await openSettings(page);
    await page.getByTestId("setting-start-screen").selectOption("continue");
    await page.reload();
    await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
  });

  test("export downloads preferences only", async ({ page }) => {
    await openSettings(page);
    await page.getByTestId("setting-theme").selectOption("light");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("setting-export").click(),
    ]);
    expect(download.suggestedFilename()).toBe("quranroots-preferences.json");
    const path = await download.path();
    const body = JSON.parse(await (await import("node:fs/promises")).readFile(path!, "utf8"));
    expect(body).toMatchObject({ app: "QuranRoots", kind: "preferences", version: 1 });
    expect(body.preferences.theme).toBe("light");
    expect(Object.keys(body.preferences).sort()).toEqual(
      ["locale", "reduceMotion", "startScreen", "textSize", "theme"].sort(),
    );
    await expect(page.getByTestId("setting-status")).toHaveText("Preferences exported");
  });

  test("reset asks first, can be cancelled, then restores defaults but keeps reading data", async ({
    page,
  }) => {
    await page.getByTestId("tab-quran").click();
    await page.locator(".list-row").nth(1).click();
    await expect(page.locator("h1")).toHaveText("Al-Baqara");
    await page.goto("/");
    await openSettings(page);
    await page.getByTestId("setting-theme").selectOption("light");
    await page.getByTestId("setting-text-size").selectOption("large");
    await page.getByTestId("setting-reduce-motion").click();

    await page.getByTestId("setting-reset").click();
    await expect(page.getByTestId("reset-dialog")).toBeVisible();
    await page.getByTestId("reset-cancel").click();
    await expect(page.getByTestId("reset-dialog")).toHaveCount(0);
    await expect(page.getByTestId("setting-theme")).toHaveValue("light");

    await page.getByTestId("setting-reset").click();
    await page.getByTestId("reset-confirm").click();
    await expect(page.getByTestId("setting-theme")).toHaveValue("dark");
    await expect(page.getByTestId("setting-text-size")).toHaveValue("medium");
    await expect(page.getByTestId("setting-reduce-motion")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).not.toHaveClass(/reduce-motion/);

    // Reading position survives: the Home reading card still points at it.
    const kept = await page.evaluate(() => localStorage.getItem("qr.reading.position"));
    expect(kept).toContain("2");
  });
});

test.describe("Settings localisation and RTL", () => {
  test.beforeEach(async ({ page }) => boot(page));

  test("French labels", async ({ page }) => {
    await page.getByTestId("home-language-toggle").click(); // FR
    await openSettings(page);
    await expect(page.getByText("Écran de démarrage")).toBeVisible();
    await expect(page.getByTestId("setting-theme").locator("option")).toHaveText([
      "Minuit",
      "Ivoire clair",
      "Suivre l'appareil",
    ]);
  });

  test("Arabic labels render right-to-left", async ({ page }) => {
    await page.getByTestId("home-language-toggle").click();
    await page.getByTestId("home-language-toggle").click(); // AR
    await openSettings(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("شاشة البداية")).toBeVisible();
    await expect(page.getByTestId("setting-theme").locator("option")).toHaveText([
      "منتصف الليل",
      "عاجي فاتح",
      "مطابقة الجهاز",
    ]);
  });
});
