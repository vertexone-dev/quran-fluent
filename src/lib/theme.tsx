import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "quranroots-theme";

type ThemeState = { theme: ThemeMode; setTheme: (mode: ThemeMode) => void };

// QR-UI-002A: Midnight Teal (.dark) is now the approved default brand
// identity -- "system" no longer decides the no-preference case, since that
// would show the plain ivory theme to every light-OS visitor. Light theme
// stays fully available via the explicit "light" choice below; this only
// changes what a first-time visitor with no stored preference sees.
const ThemeContext = createContext<ThemeState>({ theme: "dark", setTheme: () => {} });

function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default changed from "system" to "dark" (QR-UI-002A): a visitor with no
  // stored preference now sees the approved Midnight Teal identity
  // regardless of OS preference, instead of it being decided by whichever
  // color-scheme their OS happens to prefer. Explicit "light" and "system"
  // remain one click away via ThemeToggle.
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial = stored ?? "dark";
    setThemeState(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      applyTheme((window.localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? "dark");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
