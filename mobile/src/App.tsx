import { useEffect, useMemo, useState } from "react";
import type { Database } from "sql.js";

import { loadContentDb, getContentVersion, type ContentVersion } from "./db";
import { DbContext } from "./DbContext";
import { I18nContext, getDictionary, type Locale } from "./i18n";
import {
  getStoredLocale,
  setStoredLocale,
  getStoredTheme,
  setStoredTheme as persistTheme,
  type ThemePreference,
} from "./local-store";
import { TabBar } from "./TabBar";
import { SplashScreen } from "./screens/SplashScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SurahListScreen } from "./screens/SurahListScreen";
import { ReadingScreen } from "./screens/ReadingScreen";
import { WordListScreen } from "./screens/WordListScreen";
import { WordDetailsScreen } from "./screens/WordDetailsScreen";
import { LessonsScreen } from "./screens/LessonsScreen";
import { LessonPlayerScreen } from "./screens/LessonPlayerScreen";
import { PracticeScreen } from "./screens/PracticeScreen";
import { MoreScreen } from "./screens/MoreScreen";
import { OfflineAccessScreen } from "./screens/OfflineAccessScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TAB_HOME_ROUTE, type Route, type Tab } from "./navigation";

function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return prefersDark;
}

export function App() {
  const [db, setDb] = useState<Database | null>(null);
  const [version, setVersion] = useState<ContentVersion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale() ?? "en");
  const [theme, setTheme] = useState<ThemePreference>(() => getStoredTheme());
  const prefersDark = useSystemPrefersDark();

  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Route[]>([{ screen: "home" }]);

  useEffect(() => {
    loadContentDb()
      .then((loaded) => {
        setDb(loaded);
        setVersion(getContentVersion(loaded));
      })
      .catch((err) => setError(String(err?.message ?? err)));
  }, []);

  useEffect(() => {
    const isDark = theme === "dark" || (theme === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, [theme, prefersDark]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    setStoredLocale(next);
  }

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    persistTheme(next);
  }

  const i18nValue = useMemo(() => ({ locale, setLocale, d: getDictionary(locale) }), [locale]);

  function handleNavigate(route: Route) {
    const matchingTab = (Object.entries(TAB_HOME_ROUTE) as [Tab, Route][]).find(
      ([, r]) => r.screen === route.screen,
    )?.[0];
    if (matchingTab) {
      setTab(matchingTab);
      setStack([route]);
    } else {
      setStack((prev) => [...prev, route]);
    }
  }

  function handleSelectTab(nextTab: Tab) {
    setTab(nextTab);
    setStack([TAB_HOME_ROUTE[nextTab]]);
  }

  function handleBack() {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Offline content failed to load</h1>
        <p style={{ color: "var(--destructive)" }}>{error}</p>
      </main>
    );
  }

  if (!db) {
    return (
      <I18nContext.Provider value={i18nValue}>
        <SplashScreen />
      </I18nContext.Provider>
    );
  }

  const route = stack[stack.length - 1]!;

  return (
    <I18nContext.Provider value={i18nValue}>
      <DbContext.Provider value={{ db, version }}>
        <div className="app-shell">
          <div className="screen">
            {route.screen === "home" && <HomeScreen onNavigate={handleNavigate} />}
            {route.screen === "surah-list" && <SurahListScreen onNavigate={handleNavigate} />}
            {route.screen === "reading" && (
              <ReadingScreen
                surahNumber={route.surahNumber}
                onNavigate={handleNavigate}
                onBack={handleBack}
              />
            )}
            {route.screen === "word-list" && (
              <WordListScreen onNavigate={handleNavigate} onBack={handleBack} />
            )}
            {route.screen === "word-details" && (
              <WordDetailsScreen
                wordId={route.wordId}
                onNavigate={handleNavigate}
                onBack={handleBack}
              />
            )}
            {route.screen === "lessons" && <LessonsScreen onNavigate={handleNavigate} />}
            {route.screen === "lesson-player" && (
              <LessonPlayerScreen
                lessonId={route.lessonId}
                startAtFirstExercise={route.startAtFirstExercise}
                onBack={handleBack}
              />
            )}
            {route.screen === "practice" && <PracticeScreen onNavigate={handleNavigate} />}
            {route.screen === "more" && <MoreScreen onNavigate={handleNavigate} />}
            {route.screen === "offline-access" && <OfflineAccessScreen onBack={handleBack} />}
            {route.screen === "settings" && (
              <SettingsScreen onBack={handleBack} theme={theme} onThemeChange={handleThemeChange} />
            )}
          </div>
          <TabBar active={tab} onSelect={handleSelectTab} />
        </div>
      </DbContext.Provider>
    </I18nContext.Provider>
  );
}
