import { test, expect, type Page } from "@playwright/test";

/**
 * Regression coverage for the authentication-route hydration mismatch
 * fixed in src/routes/_authenticated/route.tsx.
 *
 * _authenticated's beforeLoad used to `throw redirect({ to: "/auth" })` for
 * an unauthenticated visitor. This route is ssr:false -- the server has no
 * way to check Supabase auth at all (its Supabase client is configured with
 * `storage: undefined`, see src/integrations/supabase/client.server.ts), so
 * the server always rendered an empty placeholder for the whole protected
 * subtree. On the client, that thrown redirect swapped the matched route
 * straight to /auth's real content while this route's ssr:false hydration
 * handoff (ClientOnly's fallback -> children flip) was still completing, so
 * React tried to hydrate AuthPage's real markup against the server's empty
 * placeholder -- a genuine, 100% reproducible hydration mismatch on every
 * unauthenticated visit to a protected route. `git show b92390f` confirms
 * this was a previously-known, explicitly-deferred second mechanism (the
 * first, a lazyRouteComponent code-splitting race, was already fixed by
 * that commit's `codeSplitGroupings: []` on auth.tsx).
 *
 * The fix moves the redirect into a useEffect inside AuthenticatedLayout --
 * the same pattern AuthPage already uses for its own already-logged-in
 * redirect -- which cannot run until after this route's own hydration has
 * committed, so the navigation to /auth is always an ordinary post-hydration
 * client-side transition, never a hydration mismatch.
 *
 * Runs entirely unauthenticated (the "public" project, no storageState): a
 * signed-in visitor would never see either code path this suite covers.
 */

function watchForHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /hydrat/i.test(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    if (/hydrat/i.test(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

async function useFrenchLocale(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("quranroots-locale", "fr");
  });
}

for (const locale of ["English", "French"] as const) {
  test.describe(`authentication-route hydration (${locale})`, () => {
    test(`an unauthenticated visitor redirected from a protected route lands on /auth?mode=login with no hydration errors`, async ({
      page,
    }) => {
      if (locale === "French") await useFrenchLocale(page);
      const hydrationErrors = watchForHydrationErrors(page);

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\?mode=login/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      expect(hydrationErrors).toEqual([]);
    });

    for (const mode of ["signup", "forgot"] as const) {
      test(`/auth?mode=${mode} hydrates with no hydration errors`, async ({ page }) => {
        if (locale === "French") await useFrenchLocale(page);
        const hydrationErrors = watchForHydrationErrors(page);

        await page.goto(`/auth?mode=${mode}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        expect(hydrationErrors).toEqual([]);
      });
    }
  });
}
