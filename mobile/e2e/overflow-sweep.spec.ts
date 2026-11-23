import { test, expect, type Page } from "@playwright/test";

/**
 * QR-DESIGN-007C: no screen may push content past the viewport edges on a narrow
 * phone at the largest iOS text size (3.12x = AX5), in English, French and Arabic.
 * This sweep exists because the iPhone SE AX5 UI tests found overflows one screen at a
 * time (Surah row, greeting, Learn categories); a browser sweep finds the common
 * cases for every screen at once. WebKit lays out a few things differently from
 * Chromium, so the iOS UI tests remain the authority.
 */
test.use({ viewport: { width: 375, height: 667 } });

async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".appbar-title")).toHaveText("QuranRoots", { timeout: 15_000 });
}

/** Elements whose box crosses the viewport's left/right edge, ignoring anything that
 * lives inside a horizontally scrollable container or is intentionally off-screen. */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad: string[] = [];
    const scrollableX = (el: Element | null): boolean => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const ox = getComputedStyle(e).overflowX;
        if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth) return true;
      }
      return false;
    };
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.closest("svg")) continue;
      // Squeezed text: a long Latin word in a box about two characters wide stacks one letter per line
      // (Arabic words are legitimately about two em wide, so they are not checked).
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n.textContent || "").trim())
        .join("");
      if (
        own.length >= 6 &&
        /^[A-Za-z\u00C0-\u00FF'’-]+$/.test(own) &&
        r.width < parseFloat(cs.fontSize) * 2.2
      ) {
        bad.push(
          `squeezed ${el.tagName.toLowerCase()} "${own.slice(0, 20)}" is ${Math.round(r.width)}px wide at ${cs.fontSize}`,
        );
      }
      if (r.right > vw + 1 || r.left < -1) {
        if (scrollableX(el.parentElement)) continue;
        const label = (el.textContent || "").trim().slice(0, 30);
        bad.push(
          `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 40)} "${label}" [${Math.round(r.left)}..${Math.round(r.right)}] of ${vw}`,
        );
      }
    }
    return bad;
  });
}

const SCREENS: [string, (p: Page) => Promise<void>][] = [
  ["Home", async () => {}],
  ["Quran list", async (p) => void (await p.getByTestId("tab-quran").click())],
  [
    "Reader",
    async (p) => {
      await p.getByTestId("tab-quran").click();
      await p.locator(".surah-row button").first().click();
    },
  ],
  ["Learn", async (p) => void (await p.getByTestId("tab-learn").click())],
  ["Progress", async (p) => void (await p.getByTestId("tab-progress").click())],
  ["Settings list", async (p) => void (await p.getByTestId("tab-settings").click())],
  [
    "Settings: General",
    async (p) => {
      await p.getByTestId("tab-settings").click();
      await p.getByTestId("settings-nav-general").click();
    },
  ],
  [
    "Settings: Quran & Reading",
    async (p) => {
      await p.getByTestId("tab-settings").click();
      await p.getByTestId("settings-nav-reading").click();
    },
  ],
  [
    "Settings: Language",
    async (p) => {
      await p.getByTestId("tab-settings").click();
      await p.getByTestId("settings-language-row").click();
    },
  ],
  [
    "Settings: Appearance",
    async (p) => {
      await p.getByTestId("tab-settings").click();
      await p.getByTestId("settings-nav-appearance").click();
    },
  ],
  [
    "Settings: Privacy & Data",
    async (p) => {
      await p.getByTestId("tab-settings").click();
      await p.getByTestId("settings-nav-privacy").click();
    },
  ],
  [
    "About & Sources",
    async (p) => {
      await p.getByTestId("tab-settings").click();
      await p.getByTestId("setting-about").click();
    },
  ],
  ["Understand", async (p) => void (await p.getByTestId("home-tile-understand").click())],
  ["Reflect", async (p) => void (await p.getByTestId("home-tile-reflect").click())],
  ["Memorize", async (p) => void (await p.getByTestId("home-tile-memorize").click())],
  ["Bookmarks", async (p) => void (await p.getByTestId("home-tile-bookmarks").click())],
  ["Practice", async (p) => void (await p.getByTestId("home-shortcut-practice").click())],
  ["Offline", async (p) => void (await p.getByTestId("home-shortcut-offline").click())],
  ["Profile & More", async (p) => void (await p.getByTestId("profile-button").click())],
];

for (const [lang, toggles] of [
  ["English", 0],
  ["French", 1],
  ["Arabic", 2],
] as const) {
  test.describe(`${lang} at 3.12x on a 375pt phone`, () => {
    for (const [name, go] of SCREENS) {
      test(`${name} has no horizontal overflow`, async ({ page }) => {
        await boot(page);
        for (let i = 0; i < toggles; i++) await page.getByTestId("home-language-toggle").click();
        await page.evaluate(() =>
          document.documentElement.style.setProperty("--qr-system-text-scale", "3.12"),
        );
        await go(page);
        await page.waitForTimeout(250);
        expect(await overflowing(page)).toEqual([]);
      });
    }
  });
}

test.describe("About & Sources stays readable at 3.12x on a 375pt phone (QR-DESIGN-007C)", () => {
  // Found by the iPhone SE AX5 UI test: the two-column details grid squeezed the value to a
  // single character per line. Overflow checks cannot see that, so measure the value width.
  for (const [lang, toggles] of [
    ["English", 0],
    ["French", 1],
    ["Arabic", 2],
  ] as const) {
    test(`${lang}: every source value has a readable width`, async ({ page }) => {
      await boot(page);
      for (let i = 0; i < toggles; i++) await page.getByTestId("home-language-toggle").click();
      await page.evaluate(() =>
        document.documentElement.style.setProperty("--qr-system-text-scale", "3.12"),
      );
      await page.getByTestId("tab-settings").click();
      await page.getByTestId("setting-about").click();
      const widths = await page
        .locator(".source-meta dd")
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
      expect(widths.length).toBeGreaterThanOrEqual(9);
      for (const w of widths) expect(w).toBeGreaterThanOrEqual(150);
    });
  }

  test("at the default size label and value share a line", async ({ page }) => {
    await boot(page);
    await page.getByTestId("tab-settings").click();
    await page.getByTestId("setting-about").click();
    const row = page.locator(".source-row").first();
    const [dt, dd] = await Promise.all([
      row.locator("dt").boundingBox(),
      row.locator("dd").boundingBox(),
    ]);
    expect(Math.abs(dt!.y - dd!.y)).toBeLessThan(6);
  });
});
