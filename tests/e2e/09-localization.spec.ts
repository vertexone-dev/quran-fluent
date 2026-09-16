import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

test.describe("localization (EN/FR)", () => {
  /**
   * Always restore the shared E2E user's locale to English.
   *
   * This runs even when a localization assertion fails, preventing this
   * spec from leaking French profile state into bookmarks, notes,
   * memorization, practice, or any later authenticated spec.
   */
  test.afterEach(async () => {
    const { client, userId } = await createTestUserClient();

    const { error } = await client
      .from("profiles")
      .update({
        interface_language: "en",
      })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to restore E2E profile language to English: ${error.message}`);
    }

    await expect
      .poll(async () => {
        const { data, error: readError } = await client
          .from("profiles")
          .select("interface_language")
          .eq("id", userId)
          .single();

        if (readError) {
          throw readError;
        }

        return data?.interface_language;
      })
      .toBe("en");
  });

  test("switching to French updates the UI, the <html lang>, and persists to the profile", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    const switcher = page
      .getByRole("group", {
        name: "Change language",
      })
      .first();

    await switcher
      .getByRole("button", {
        name: /FR/,
      })
      .click();

    /*
     * Verify the document locale changed.
     */
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    /*
     * Verify translated UI appeared.
     *
     * The language switcher's accessible label itself is translated,
     * making it a stable indication that the UI switched to French.
     *
     * This is more reliable than depending on one specific navigation
     * link such as "Tableau de bord".
     */
    await expect(
      page
        .getByRole("group", {
          name: "Changer de langue",
        })
        .first(),
    ).toBeVisible();

    /*
     * Verify French was persisted to the authenticated user's profile.
     */
    const { client, userId } = await createTestUserClient();

    await expect
      .poll(async () => {
        const { data, error } = await client
          .from("profiles")
          .select("interface_language")
          .eq("id", userId)
          .single();

        if (error) {
          throw error;
        }

        return data?.interface_language;
      })
      .toBe("fr");

    /*
     * Verify persistence across a browser reload rather than merely
     * checking transient client-side state.
     */
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    await expect(
      page
        .getByRole("group", {
          name: "Changer de langue",
        })
        .first(),
    ).toBeVisible();

    /*
     * We intentionally do NOT reset the profile here.
     *
     * afterEach performs the cleanup so it happens whether this test
     * passes or throws at any assertion above.
     */
  });

  test("switching language updates the document (browser-tab) title immediately, with no reload", async ({
    page,
  }) => {
    // No waitUntil: "networkidle" here -- I18nProvider's generation-counter
    // guard (src/lib/i18n.tsx) now makes a manual switch immune to the
    // signed-in profile-locale fetch it fires on mount, regardless of
    // whether that fetch is still in flight when the click below happens.
    // See "a delayed profile-locale response can never override a manual
    // switch" below for a deterministic, network-controlled proof of that
    // guarantee.
    //
    // The homepage is a regular ssr:true route, unlike /dashboard, so its
    // language switcher exists in the server-rendered HTML before React
    // attaches any event handlers to it -- a click that lands before
    // hydration completes is a real click on an inert button and is simply
    // lost. Waiting for TanStack Start's own hydration-complete signal
    // (not a guessed delay) before interacting avoids that.
    await page.goto("/");
    await page.waitForFunction(() => {
      const tsr = (window as unknown as { $_TSR?: { hydrated?: boolean } }).$_TSR;
      return !tsr || tsr.hydrated === true;
    });
    await expect(page).toHaveTitle("QuranRoots — Learn Arabic. Understand the Qur'an.");

    const switcher = page.getByRole("group", { name: "Change language" }).first();
    await switcher.getByRole("button", { name: /FR/ }).click();

    // Wait for the switch itself to land (same stable signal the sibling
    // test above uses) before checking the title, so this never races the
    // locale-switch UI update.
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    // useDocumentTitle's effect re-runs as soon as the locale-dependent
    // title string changes -- no page.reload() anywhere in this test.
    await expect(page).toHaveTitle("QuranRoots — Apprenez l'arabe. Comprenez le Coran.");

    // Client-side navigation to another previously-fixed route keeps the
    // title correctly localized without a reload either.
    await page.getByRole("link", { name: "Fonctionnalités" }).first().click();
    await expect(page).toHaveTitle("Fonctionnalités — QuranRoots");
  });

  test("a delayed profile-locale response can never override a manual switch made after it started", async ({
    page,
  }) => {
    // Regression test for the I18nProvider race (src/lib/i18n.tsx): on
    // mount, I18nProvider fires an async fetch of the signed-in user's
    // saved profile locale and, before the fix, unconditionally applied
    // whatever it returned -- even if a manual setLocale() call had
    // already happened after the fetch started. The fix adds a
    // generation counter that setLocale() bumps and the fetch's result
    // handler checks before applying, so a stale response is discarded
    // instead of clobbering the newer manual choice.
    //
    // This test forces that exact ordering deterministically: the
    // profile-locale GET is held open (not delayed by a guessed
    // timeout) until *after* the manual switch below has already landed,
    // and it deliberately resolves to "en" -- the opposite of the "fr"
    // switched to manually -- so the pre-fix bug would flip the locale
    // back to English as soon as it's released.
    const { client, userId } = await createTestUserClient();
    await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);

    let releaseProfileFetch = () => {};
    const profileFetchHeld = new Promise<void>((resolve) => {
      releaseProfileFetch = resolve;
    });

    await page.route("**/rest/v1/profiles*interface_language*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await profileFetchHeld;
      await route.continue();
    });

    const responsePromise = page.waitForResponse((res) =>
      /\/rest\/v1\/profiles\?select=interface_language/.test(res.url()),
    );

    await page.goto("/dashboard");

    const switcher = page.getByRole("group", { name: "Change language" }).first();
    await switcher.getByRole("button", { name: /FR/ }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    // Only now let the held-back fetch (still resolving to the stale "en"
    // profile value) reach the network.
    releaseProfileFetch();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    // The manual choice must survive the stale response landing after it.
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("group", { name: "Changer de langue" }).first()).toBeVisible();
  });

  test("the 404 page and the footer tagline are translated, not hard-coded English", async ({
    page,
  }) => {
    // Regression test: __root.tsx's NotFoundComponent/ErrorComponent and
    // Logo's tagline/alt text used to hard-code their English copy even
    // though src/locales/{en,fr}/common.ts already had proper
    // `errors.*`/`brand.tagline`/`brand.logoAlt` translations sitting
    // unused — a French learner hitting a bad link or seeing the footer
    // saw English regardless of their chosen locale.
    await page.goto("/dashboard");
    await page
      .getByRole("group", { name: "Change language" })
      .first()
      .getByRole("button", { name: /FR/ })
      .click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    // The locale choice is also written to localStorage (see src/lib/i18n.tsx
    // setLocale), so it carries over when navigating to a page the
    // authenticated layout doesn't render a footer on (/dashboard has none —
    // SiteFooter is public-pages-only) or to a route with no layout of its
    // own at all (the 404 page).
    await page.goto("/");
    // exact: true -- the footer's own copyright line separately includes
    // this same tagline as a substring, so a non-exact match is ambiguous.
    await expect(
      page.getByText("Remontez à la langue. Découvrez le sens.", { exact: true }),
    ).toBeVisible();

    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    await expect(
      page.getByText("La page que vous cherchez n'existe pas ou a été déplacée."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toBeVisible();
  });

  test("UI direction stays LTR while embedded Arabic content is marked RTL", async ({ page }) => {
    await page.goto("/quran");

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    const bismillah = page.getByText("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");

    await expect(bismillah).toHaveAttribute("dir", "rtl");
    await expect(bismillah).toHaveAttribute("lang", "ar");
  });
});
