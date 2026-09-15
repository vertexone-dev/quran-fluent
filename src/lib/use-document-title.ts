import { useEffect } from "react";

// Keeps the live browser-tab title in sync with the active interface
// language. Each route's static `head()` meta title is set once, before
// the real locale is known (locale is resolved client-side after
// hydration -- see src/lib/i18n.tsx), so it stays English-only by
// necessity; it still correctly covers SSR output and the og:title/
// twitter:card social-preview tags, which this hook does not touch. This
// hook only updates the visible `document.title` once the real locale is
// available, built from strings already in the existing dictionaries via
// useI18n() -- no new translation infrastructure.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
