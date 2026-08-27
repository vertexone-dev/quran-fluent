import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dictionaries, isLocale, SUPPORTED_LOCALES, type Dictionary, type Locale } from "@/locales";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isRtlLocale } from "@/lib/locale-resolution";

const STORAGE_KEY = "quranroots-locale";

export type { Locale };
export { SUPPORTED_LOCALES, isRtlLocale };

export const LOCALE_LABELS: Record<Locale, { label: string; short: string }> = {
  en: { label: "English", short: "EN" },
  fr: { label: "Français", short: "FR" },
};

type Vars = Record<string, string | number>;

type I18nState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dotted key, e.g. t("common.nav.learn"). */
  t: (key: string, vars?: Vars) => string;
  /** Read a structured node (array/object) from the dictionary. */
  d: Dictionary;
};

/**
 * Default value = read-only English. A missing provider (or, in dev, a stale
 * HMR module instance holding a second copy of this context) then degrades to
 * untranslated-but-working UI instead of throwing and blanking the screen.
 */
const FALLBACK_STATE: I18nState = {
  locale: "en",
  setLocale: () => {},
  d: dictionaries.en,
  t: (key, vars) => {
    const found = lookup(dictionaries.en, key);
    if (typeof found === "string") return interpolate(found, vars);
    if (typeof found === "number") return String(found);
    return key;
  },
};

const I18nContext = createContext<I18nState>(FALLBACK_STATE);

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  for (const lang of navigator.languages ?? [navigator.language]) {
    const base = lang?.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

function lookup(dict: Dictionary, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

function interpolate(value: string, vars?: Vars) {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<Locale>("en");
  const [hydrated, setHydrated] = useState(false);

  // Client-side initial resolution: stored choice → browser hint → English.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = isLocale(stored) ? stored : detectBrowserLocale();
    setLocaleState(initial);
    setHydrated(true);
  }, []);

  // Signed-in learners: their saved profile language wins.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("interface_language")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const saved = data?.interface_language;
      if (isLocale(saved)) {
        setLocaleState(saved);
        window.localStorage.setItem(STORAGE_KEY, saved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Global app direction now follows the active locale (ar/ur -> rtl,
    // everything else -> ltr) -- previously hardcoded to "ltr" always.
    // Canonical Qur'anic/Arabic content is unaffected: it carries its own
    // local dir="rtl" lang="ar" marking independent of this setting.
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? "rtl" : "ltr";
  }, [locale, hydrated]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      if (user?.id) {
        // supabase-js query builders are lazy thenables: the request is only
        // sent once something calls .then()/awaits them. `void` alone
        // discards a value without doing that, so it silently never fired.
        void supabase
          .from("profiles")
          .update({ interface_language: next })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) console.error("Failed to persist interface_language", error);
          });
      }
    },
    [user?.id],
  );

  const value = useMemo<I18nState>(() => {
    const dict = dictionaries[locale];
    return {
      locale,
      setLocale,
      d: dict,
      t: (key, vars) => {
        const found = lookup(dict, key) ?? lookup(dictionaries.en, key);
        if (typeof found === "string") return interpolate(found, vars);
        if (typeof found === "number") return String(found);
        return key;
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
