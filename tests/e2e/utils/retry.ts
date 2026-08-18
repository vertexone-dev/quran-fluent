import { type Locator } from "@playwright/test";

/**
 * Fills `locator` and waits for `expected`, retrying the fill if it doesn't
 * land in time. A fill executed before React finishes hydrating can set the
 * DOM value directly without the input's onChange (and thus React state)
 * ever firing — the value looks typed but the app never saw it. Retrying
 * is more reliable than trying to detect "hydration is done" from outside
 * the app (see the analogous login race in utils/auth.ts).
 */
export async function fillUntil(
  locator: Locator,
  value: string,
  expected: () => Promise<void>,
  attempts = 3,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await locator.fill("");
    await locator.fill(value);
    try {
      await expected();
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
    }
  }
}
