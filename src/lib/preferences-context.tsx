import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MotionConfig } from "framer-motion";

import {
  DEFAULT_PREFERENCES,
  START_SCREEN_PATH,
  START_SESSION_KEY,
  TEXT_SCALE,
  clearPreferences,
  readPreferences,
  writePreferences,
  type DisplayPreferences,
} from "@/lib/preferences";

type PreferencesState = {
  prefs: DisplayPreferences;
  /** True once the stored values were read on the client. */
  ready: boolean;
  setPref: <K extends keyof DisplayPreferences>(key: K, value: DisplayPreferences[K]) => void;
  reset: () => void;
};

const PreferencesContext = createContext<PreferencesState>({
  prefs: DEFAULT_PREFERENCES,
  ready: false,
  setPref: () => {},
  reset: () => {},
});

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function applyToDocument(prefs: DisplayPreferences) {
  const root = document.documentElement;
  root.style.fontSize = TEXT_SCALE[prefs.textSize];
  root.setAttribute("data-qr-text", prefs.textSize);
  root.setAttribute("data-qr-motion", prefs.reduceMotion ? "reduce" : "full");
}

/** Holds the device-local display preferences. SSR renders the defaults and
 * the stored values are applied after mount, so server and first client
 * render always match (same approach as ThemeProvider). */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readPreferences(storage());
    setPrefs(stored);
    applyToDocument(stored);
    setReady(true);
  }, []);

  const setPref = useCallback<PreferencesState["setPref"]>((key, value) => {
    setPrefs((current) => {
      const next = { ...current, [key]: value };
      writePreferences(storage(), next);
      applyToDocument(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearPreferences(storage());
    setPrefs(DEFAULT_PREFERENCES);
    applyToDocument(DEFAULT_PREFERENCES);
  }, []);

  const value = useMemo(() => ({ prefs, ready, setPref, reset }), [prefs, ready, setPref, reset]);

  return (
    <PreferencesContext.Provider value={value}>
      <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>{children}</MotionConfig>
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

/** Honors "Start screen": on the first visit to "/" in a browser session it
 * opens the chosen screen. Later visits to Home in the same session are left
 * alone, and the default ("home") never redirects. */
export function useStartScreenRedirect(navigate: (to: "/quran" | "/learn") => void) {
  const { prefs, ready } = usePreferences();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    try {
      if (window.sessionStorage.getItem(START_SESSION_KEY)) return;
      window.sessionStorage.setItem(START_SESSION_KEY, "1");
    } catch {
      return;
    }
    const target = START_SCREEN_PATH[prefs.startScreen];
    if (target !== "/") navigate(target);
  }, [ready, prefs.startScreen, navigate]);
}
