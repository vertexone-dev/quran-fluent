import { useEffect, useMemo, useState } from "react";
import type { Database } from "sql.js";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

import { loadContentDb, getContentVersion, type ContentVersion } from "./db";
import { DbContext } from "./DbContext";
import { HistoryProvider, useHistoryStack } from "./HistoryContext";
import { I18nContext, getDictionary, type Locale } from "./i18n";
import {
  getStoredLocale,
  setStoredLocale,
  getStoredTheme,
  setStoredTheme as persistTheme,
  resolveIsDark,
  type ThemePreference,
} from "./local-store";
import { TabBar } from "./TabBar";
import { SplashScreen } from "./screens/SplashScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SurahListScreen } from "./screens/SurahListScreen";
import { ReadingScreen } from "./screens/ReadingScreen";
import { AyahBookmarksScreen } from "./screens/AyahBookmarksScreen";
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

  useEffect(() => {
    loadContentDb()
      .then((loaded) => {
        setDb(loaded);
        setVersion(getContentVersion(loaded));
      })
      .catch((err) => setError(String(err?.message ?? err)));
  }, []);

  useEffect(() => {
    const isDark = resolveIsDark(theme, prefersDark);
    document.documentElement.classList.toggle("dark", isDark);

    // SystemBars (bundled with @capacitor/core since 8.0, no separate
    // plugin) has no web implementation -- it rejects every call outside
    // the native Android/iOS runtime, which is exactly where `npm run
    // dev`/Playwright always run this. isNativePlatform() skips the call
    // there entirely instead of catching an always-expected rejection, so
    // a real native-side failure (which .catch() below still surfaces,
    // not swallows) is never confused with that expected case.
    if (Capacitor.isNativePlatform()) {
      SystemBars.setStyle({ style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
        (err: unknown) => {
          console.error("SystemBars.setStyle failed:", err);
        },
      );
    }
  }, [theme, prefersDark]);

  // Screen readers use <html lang> to pick pronunciation rules; without
  // this, French UI text was always announced as if it were English.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    setStoredLocale(next);
  }

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    persistTheme(next);
  }

  const i18nValue = useMemo(() => ({ locale, setLocale, d: getDictionary(locale) }), [locale]);

  if (error) {
    const d = getDictionary(locale);
    return (
      <main style={{ padding: 24 }}>
        <h1>{d.common.contentLoadError}</h1>
        <p style={{ color: "var(--destructive)" }}>{error}</p>
      </main>
    );
  }

  return (
    <I18nContext.Provider value={i18nValue}>
      <HistoryProvider>
        {!db ? (
          <SplashScreen />
        ) : (
          <DbContext.Provider value={{ db, version }}>
            <Navigator theme={theme} onThemeChange={handleThemeChange} prefersDark={prefersDark} />
          </DbContext.Provider>
        )}
      </HistoryProvider>
    </I18nContext.Provider>
  );
}

type AppState = { tab: Tab; stack: Route[] };

const INITIAL_STATE: AppState = { tab: "home", stack: [{ screen: "home" }] };

/**
 * Every transition -- a tab switch or a route push -- goes through
 * `transition()`, which registers (via pushFrame) a closure that restores
 * the state being left, then applies the next state. Going back (hardware
 * or an in-app back control, both funneled through HistoryContext's
 * goBack()) always runs that same closure, so there is exactly one
 * mechanism for "what does back do here," never a separate hand-maintained
 * notion of stack depth that the real WebView history could drift out of
 * sync with.
 */
function Navigator({
  theme,
  onThemeChange,
  prefersDark,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  prefersDark: boolean;
}) {
  const { pushFrame, goBack } = useHistoryStack();
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  function transition(next: AppState) {
    const previous = state;
    pushFrame(() => setState(previous));
    setState(next);
  }

  function handleNavigate(route: Route) {
    const matchingTab = (Object.entries(TAB_HOME_ROUTE) as [Tab, Route][]).find(
      ([, r]) => r.screen === route.screen,
    )?.[0];
    transition(
      matchingTab
        ? { tab: matchingTab, stack: [route] }
        : { tab: state.tab, stack: [...state.stack, route] },
    );
  }

  function handleSelectTab(nextTab: Tab) {
    transition({ tab: nextTab, stack: [TAB_HOME_ROUTE[nextTab]] });
  }

  const route = state.stack[state.stack.length - 1]!;

  return (
    <div className="app-shell">
      <div className="screen">
        {route.screen === "home" && (
          <HomeScreen
            onNavigate={handleNavigate}
            theme={theme}
            onThemeChange={onThemeChange}
            prefersDark={prefersDark}
          />
        )}
        {route.screen === "surah-list" && <SurahListScreen onNavigate={handleNavigate} />}
        {route.screen === "reading" && (
          <ReadingScreen
            surahNumber={route.surahNumber}
            targetAyahNumber={route.targetAyahNumber}
            onNavigate={handleNavigate}
            onBack={goBack}
          />
        )}
        {route.screen === "ayah-bookmarks" && (
          <AyahBookmarksScreen onNavigate={handleNavigate} onBack={goBack} />
        )}
        {route.screen === "word-list" && (
          <WordListScreen onNavigate={handleNavigate} onBack={goBack} />
        )}
        {route.screen === "word-details" && (
          <WordDetailsScreen wordId={route.wordId} onNavigate={handleNavigate} onBack={goBack} />
        )}
        {route.screen === "lessons" && <LessonsScreen onNavigate={handleNavigate} />}
        {route.screen === "lesson-player" && (
          <LessonPlayerScreen
            lessonId={route.lessonId}
            startAtFirstExercise={route.startAtFirstExercise}
            onBack={goBack}
          />
        )}
        {route.screen === "practice" && <PracticeScreen onNavigate={handleNavigate} />}
        {route.screen === "more" && <MoreScreen onNavigate={handleNavigate} />}
        {route.screen === "offline-access" && <OfflineAccessScreen onBack={goBack} />}
        {route.screen === "settings" && (
          <SettingsScreen onBack={goBack} theme={theme} onThemeChange={onThemeChange} />
        )}
      </div>
      <TabBar active={state.tab} onSelect={handleSelectTab} />
    </div>
  );
}
