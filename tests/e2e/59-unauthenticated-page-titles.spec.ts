import { test, expect } from "@playwright/test";

/**
 * Regression coverage for the homepage/features/auth document-title gap:
 * these three routes never called useDocumentTitle at all (unlike /learn,
 * /quran, /about, /dashboard and the 404 page, which already did) and so
 * kept their static, English-only head() title regardless of the active
 * locale. /auth covers every mode validateSearch's searchSchema actually
 * accepts (login/signup/forgot); /reset-password is a separate route in
 * the same password-reset flow with the identical gap, covered alongside
 * it.
 *
 * Extracted from 52-production-polish.spec.ts into the "public" Playwright
 * project (playwright.config.ts), after CI runs #114/#115 showed it
 * intermittently observing "Dashboard" instead of a /auth title. Root
 * cause: src/routes/auth.tsx correctly redirects an *authenticated* user
 * away from /auth to /dashboard via a mount-time effect (`if (!loading &&
 * user) navigate({ to: "/dashboard", ... })`) -- every prior run of this
 * test used the "authenticated" project's stored session, so every
 * /auth?mode=X navigation here was racing that redirect by design, not by
 * accident.
 *
 * This also required changing *how* French is selected. The original
 * version signed in and updated the shared account's profiles.
 * interface_language row directly, which only takes effect for a browser
 * that itself holds an authenticated Supabase session (src/lib/i18n.tsx's
 * profile-fetch effect only runs `if (user?.id)`). Run anonymously (no
 * storageState, as this fix requires), that update is invisible to the
 * page: i18n.tsx resolves locale from `localStorage["quranroots-locale"]`
 * (falling back to browser language, then "en") on every full navigation,
 * completely independent of auth -- exactly how a signed-out visitor's own
 * language toggle (LanguageSwitcher, "Available to guests and signed-in
 * learners alike") persists their choice. Setting that key directly is
 * therefore both the fix and the more faithful simulation of a real
 * anonymous visitor switching languages.
 *
 * Confirmed no other test in the suite has the auth-redirect defect:
 * audited every spec file registered under the "authenticated" project for
 * a `/auth` navigation (none found besides this one, now moved) and
 * confirmed src/routes/auth.tsx is the only route in the app with an
 * authenticated-redirect-on-mount effect (grepped every file under
 * src/routes/).
 */
test.describe("unauthenticated page titles", () => {
  test("homepage, features and every auth mode's document title are localized in English and French", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("QuranRoots — Learn Arabic. Understand the Qur'an.");
    await page.goto("/features");
    await expect(page).toHaveTitle("Features — QuranRoots");
    await page.goto("/auth?mode=login");
    await expect(page).toHaveTitle("Sign in — QuranRoots");
    await page.goto("/auth?mode=signup");
    await expect(page).toHaveTitle("Sign up — QuranRoots");
    await page.goto("/auth?mode=forgot");
    await expect(page).toHaveTitle("Reset password — QuranRoots");
    await page.goto("/reset-password");
    await expect(page).toHaveTitle("Choose a new password — QuranRoots");

    await page.evaluate(() => window.localStorage.setItem("quranroots-locale", "fr"));

    await page.goto("/");
    await expect(page).toHaveTitle("QuranRoots — Apprenez l'arabe. Comprenez le Coran.");
    await page.goto("/features");
    await expect(page).toHaveTitle("Fonctionnalités — QuranRoots");
    await page.goto("/auth?mode=login");
    await expect(page).toHaveTitle("Se connecter — QuranRoots");
    await page.goto("/auth?mode=signup");
    await expect(page).toHaveTitle("Créer un compte — QuranRoots");
    await page.goto("/auth?mode=forgot");
    await expect(page).toHaveTitle("Réinitialiser le mot de passe — QuranRoots");
    await page.goto("/reset-password");
    await expect(page).toHaveTitle("Choisissez un nouveau mot de passe — QuranRoots");
  });
});
