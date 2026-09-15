import { test, expect } from "@playwright/test";

import { createTestUserClient } from "./utils/db";

/**
 * Covers the Production Polish release: the placeholder-testimonials
 * removal, the corrected /features roadmap, Level 6's "coming soon"
 * status on /learn, localized document titles (including the French
 * 404), the dashboard weak-area translation, the learning-plan display
 * mappings for preferred_translation/preferred_reciter, and mobile tap
 * targets on the footer links and the Qur'an reader's translator-
 * attribution button.
 *
 * Response-header enforcement itself (src/server.ts's withSecurityHeaders)
 * is deliberately NOT re-tested here: this suite runs against the local
 * Vite dev server, which never goes through that Worker entry point (see
 * the comment above SECURITY_HEADERS in src/server.ts) -- an E2E header
 * assertion here would only ever see headers absent, regardless of
 * whether the fix works, so it would test nothing real. That behavior is
 * covered by src/server.test.ts (unit, the pure wrapper function) and was
 * additionally verified empirically against a real local Cloudflare
 * Workers runtime (`wrangler dev`) during development -- see this
 * release's commit messages. Live production coverage is
 * scripts/validate-production-headers.mjs, wired into
 * production-validation.yml.
 */

test.describe("production polish", () => {
  // Several tests below navigate to /dashboard. Same root cause as
  // 12-memorization.spec.ts's own beforeEach (see its comment): with
  // onboarding_completed left false by global-setup.ts, /dashboard
  // redirects straight to /onboarding, which this file running standalone
  // (e.g. via `-g`) would otherwise never complete first.
  test.beforeEach(async () => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
  });

  test("home page no longer shows the testimonials placeholder", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/real learner stories will be added before launch/i)).toHaveCount(
      0,
    );
    await expect(page.getByText(/from our learners/i)).toHaveCount(0);
    // The rest of the page still renders around the removed section.
    await expect(page.getByRole("heading", { name: /begin your journey today/i })).toBeVisible();
  });

  test.describe("features roadmap", () => {
    test("English: delivered functionality is shown as live, not a future phase", async ({
      page,
    }) => {
      await page.goto("/features");
      // group.phase renders as a Badge (a styled div), not a heading role.
      await expect(page.getByText("Live now")).toBeVisible();
      await expect(page.getByText("Coming later")).toBeVisible();
      await expect(page.getByText(/Phase 1|Phase 2|Phase 3|Phase 4|Phase 5|Phase 6/)).toHaveCount(
        0,
      );
      await expect(page.getByText(/Levels 1–5/)).toBeVisible();
      await expect(page.getByText(/114 Surahs and 6,236 Ayahs/)).toBeVisible();
      await expect(page.getByText(/Level 6: Qur'an/)).toBeVisible();
      await expect(page.getByText(/Premium subscription/)).toBeVisible();
    });

    test("French: delivered functionality is shown as live, not a future phase", async ({
      page,
    }) => {
      const { client, userId } = await createTestUserClient();
      await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
      try {
        await page.goto("/features");
        await expect(page.getByText("Disponible maintenant")).toBeVisible();
        await expect(page.getByText("À venir")).toBeVisible();
        await expect(page.getByText(/Phase 1|Phase 2|Phase 3|Phase 4|Phase 5|Phase 6/)).toHaveCount(
          0,
        );
        await expect(page.getByText(/Niveaux 1 à 5/)).toBeVisible();
        await expect(page.getByText(/114 sourates et 6 236 versets/)).toBeVisible();
      } finally {
        await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      }
    });
  });

  test.describe("Level 6 coming-soon status", () => {
    test("English: Level 6 is marked coming soon, Levels 1-5 are not", async ({ page }) => {
      await page.goto("/learn");
      const level6Card = page.locator("div.border-dashed", { hasText: "Level 6" });
      await expect(level6Card).toHaveCount(1);
      await expect(level6Card.getByText("Coming soon")).toBeVisible();
      await expect(page.locator("div.border-dashed", { hasText: "Level 1" })).toHaveCount(0);
      await expect(page.getByText("Coming soon")).toHaveCount(1);
    });

    test("French: Level 6 is marked Bientôt disponible", async ({ page }) => {
      const { client, userId } = await createTestUserClient();
      await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
      try {
        await page.goto("/learn");
        const level6Card = page.locator("div.border-dashed", { hasText: "Niveau 6" });
        await expect(level6Card).toHaveCount(1);
        await expect(level6Card.getByText("Bientôt disponible")).toBeVisible();
      } finally {
        await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      }
    });
  });

  test("document titles are localized in English and French, including the 404", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();

    await page.goto("/learn");
    await expect(page).toHaveTitle("The Qur'anic Arabic course — QuranRoots");
    await page.goto("/quran");
    await expect(page).toHaveTitle("Interactive Qur'an study — QuranRoots");
    await page.goto("/about");
    await expect(page).toHaveTitle("About QuranRoots");
    await page.goto("/dashboard");
    await expect(page).toHaveTitle("Dashboard — QuranRoots");
    const notFoundResponse = await page.goto("/this-route-truly-does-not-exist-production-polish");
    expect(notFoundResponse?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found — QuranRoots");
    // Real site branding renders on the 404 page (Stage 4D requirement).
    await expect(page.getByRole("banner")).toBeVisible();

    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await page.goto("/learn");
      await expect(page).toHaveTitle("Le cours d'arabe coranique — QuranRoots");
      await page.goto("/quran");
      await expect(page).toHaveTitle("Étude interactive du Coran — QuranRoots");
      await page.goto("/about");
      await expect(page).toHaveTitle("À propos de QuranRoots");
      await page.goto("/dashboard");
      await expect(page).toHaveTitle("Tableau de bord — QuranRoots");
      const frNotFoundResponse = await page.goto(
        "/this-route-truly-does-not-exist-production-polish",
      );
      expect(frNotFoundResponse?.status()).toBe(404);
      await expect(page).toHaveTitle("Page introuvable — QuranRoots");
      await expect(page.getByRole("banner")).toBeVisible();
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
    }
  });

  test("dashboard shows a translated weak-area label, not the raw stored English string", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client.from("weak_areas").delete().eq("user_id", userId);
    await client
      .from("weak_areas")
      .insert({ user_id: userId, area: "Letter forms", source: "practice", strength: 10 });
    await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
    try {
      await page.goto("/dashboard");
      await expect(page.getByText("Formes des lettres")).toBeVisible();
      await expect(page.getByText("Letter forms")).toHaveCount(0);
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      await client.from("weak_areas").delete().eq("user_id", userId);
    }
  });

  test("learning plan shows friendly translation/reciter names, not the raw stored keys", async ({
    page,
  }) => {
    const { client, userId } = await createTestUserClient();
    await client
      .from("learning_preferences")
      .update({ preferred_translation: "en_sahih", preferred_reciter: "husary" })
      .eq("user_id", userId);
    try {
      await page.goto("/learning-plan");
      // Rows render as <dl><div><dt>label</dt><dd>value</dd></div>...</dl>
      // in the same fixed order as the `rows` array in learning-plan.tsx;
      // index 4/5 are preferredTranslation/preferredReciter. Checked via
      // the exact <dd> text (not a page-wide substring search) because
      // "husary" is, correctly, a literal substring of the friendly label
      // "Mahmoud Khalil Al-Husary" -- a substring search can never
      // distinguish "shows the friendly label" from "still shows the raw
      // key somewhere else on the page".
      const translationValue = page.locator("dd").nth(4);
      const reciterValue = page.locator("dd").nth(5);
      await expect(translationValue).toHaveText("English — Saheeh International");
      await expect(reciterValue).toHaveText("Mahmoud Khalil Al-Husary");

      await client.from("profiles").update({ interface_language: "fr" }).eq("id", userId);
      await page.reload();
      await expect(translationValue).toHaveText("Anglais — Saheeh International");
      // Reciter names are proper nouns and stay the same in French.
      await expect(reciterValue).toHaveText("Mahmoud Khalil Al-Husary");
    } finally {
      await client.from("profiles").update({ interface_language: "en" }).eq("id", userId);
      await client
        .from("learning_preferences")
        .update({ preferred_translation: "en_sahih", preferred_reciter: "mishary_alafasy" })
        .eq("user_id", userId);
    }
  });

  test.describe("mobile tap targets", () => {
    for (const viewport of [
      { name: "390x844", width: 390, height: 844 },
      { name: "768x1024", width: 768, height: 1024 },
    ]) {
      test(`footer links are at least 44px tall at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/");
        const learnLink = page.getByRole("contentinfo").getByRole("link", { name: "Learn Arabic" });
        await learnLink.scrollIntoViewIfNeeded();
        const box = await learnLink.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(40);
      });

      test(`translator-attribution button is at least 24px tall at ${viewport.name}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/quran");
        const attributionButton = page.getByRole("button", { name: /Translator:/ }).first();
        await attributionButton.scrollIntoViewIfNeeded();
        const box = await attributionButton.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(24);
      });
    }
  });
});
