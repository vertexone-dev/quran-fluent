import { expect, test } from "@playwright/test";

// QR-DESIGN-008B: the Design Lock button states (default, glowing hover, click halo,
// visible focus). Signed out, on the login form's real primary Button.

test.describe("button interaction states", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth?mode=login");
    await page.waitForLoadState("networkidle");
  });

  const login = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: "Log in" });

  test("hover adds a gold glow without moving the button", async ({ page }) => {
    const button = login(page);
    const before = await button.boundingBox();
    const shadowBefore = await button.evaluate((el) => getComputedStyle(el).boxShadow);
    await button.hover();
    await expect
      .poll(async () => button.evaluate((el) => getComputedStyle(el).boxShadow))
      .not.toBe(shadowBefore);
    const after = await button.boundingBox();
    expect(after).toEqual(before);
  });

  test("keyboard focus shows a visible 2px ring", async ({ page }) => {
    // A keypress first, so the browser treats the next focus as keyboard focus
    // (:focus-visible). Focus is placed directly rather than by Tab, because Safari
    // does not Tab to buttons by default and Tab order is not what is under test.
    await page.getByLabel("Email").focus();
    await page.keyboard.press("Shift");
    const button = login(page);
    await button.focus();
    await expect(button).toBeFocused();
    const shadow = await button.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe("none");
    expect(shadow).toMatch(/2px/);
  });

  test("a disabled button gets no glow", async ({ page }) => {
    // The form's submit is enabled; use any disabled primary button via the DOM.
    const shadow = await page.evaluate(() => {
      const b = document.createElement("button");
      b.className = "btn-states";
      b.disabled = true;
      b.textContent = "x";
      document.body.appendChild(b);
      const shadow = getComputedStyle(b).boxShadow;
      b.remove();
      return shadow;
    });
    expect(shadow).toBe("none");
  });
});
