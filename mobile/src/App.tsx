import { useEffect, useMemo, useRef, useState } from "react";
import type { Database } from "sql.js";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

import { loadContentDb, getContentVersion, type ContentVersion } from "./db";
import { DbContext } from "./DbContext";
import { HistoryProvider, useHistoryStack } from "./HistoryContext";
import { I18nContext, getDictionary, isRtl, toContentLocale, type Locale } from "./i18n";
import {
  getStoredLocale,
  setStoredLocale,
  getStoredTheme,
  setStoredTheme as persistTheme,
  getStoredTextSize,
  setStoredTextSize as persistTextSize,
  getReduceMotion,
  setReduceMotion as persistReduceMotion,
  getStartScreen,
  getOnboardingDone,
  setOnboardingDone,
  getReadingPosition,
  resolveIsDark,
  type TextSize,
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
import { AboutScreen } from "./screens/AboutScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { UnderstandScreen } from "./screens/UnderstandScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { ReflectScreen } from "./screens/ReflectScreen";
import { MemorizeScreen } from "./screens/MemorizeScreen";
import type { PrefsControls } from "./screens/SettingsScreen";
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
  const [textSize, setTextSizeState] = useState<TextSize>(() => getStoredTextSize());
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() => getReduceMotion());
  const [onboarded, setOnboarded] = useState<boolean>(() => getOnboardingDone());
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

  // Interface text size scales every rem-based size; reduced motion is an
  // explicit in-app choice on top of the OS-level prefers-reduced-motion.
  useEffect(() => {
    document.documentElement.dataset.textSize = textSize;
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [textSize, reduceMotion]);

  // Screen readers use <html lang> to pick pronunciation rules; without
  // this, French UI text was always announced as if it were English.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    setStoredLocale(next);
  }

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    persistTheme(next);
  }

  const prefs: PrefsControls = {
    textSize,
    onTextSizeChange: (next) => {
      setTextSizeState(next);
      persistTextSize(next);
    },
    reduceMotion,
    onReduceMotionChange: (next) => {
      setReduceMotionState(next);
      persistReduceMotion(next);
    },
    // After "Reset preferences" the stored values are gone: re-read them so
    // the screen reflects the real defaults without a reload.
    onPreferencesReset: () => {
      setTheme(getStoredTheme());
      setTextSizeState(getStoredTextSize());
      setReduceMotionState(getReduceMotion());
      setLocaleState(getStoredLocale() ?? "en");
    },
  };

  const i18nValue = useMemo(
    () => ({ locale, contentLocale: toContentLocale(locale), setLocale, d: getDictionary(locale) }),
    [locale],
  );

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
            {!onboarded ? (
              <OnboardingScreen
                onDone={() => {
                  setOnboardingDone();
                  setOnboarded(true);
                }}
              />
            ) : (
              <Navigator
                theme={theme}
                onThemeChange={handleThemeChange}
                prefersDark={prefersDark}
                prefs={prefs}
              />
            )}
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
  prefs,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  prefersDark: boolean;
  prefs: PrefsControls;
}) {
  const { pushFrame, goBack } = useHistoryStack();
  const [state, setState] = useState<AppState>(() =>
    getStartScreen() === "quran" ? { tab: "quran", stack: [TAB_HOME_ROUTE.quran] } : INITIAL_STATE,
  );

  // "Continue reading" starts on Home and pushes the reader, so back returns
  // Home. With no saved reading position it simply stays on Home.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (getStartScreen() !== "continue") return;
    const position = getReadingPosition();
    if (position) {
      handleNavigate({
        screen: "reading",
        surahNumber: position.surahNumber,
        targetAyahNumber: position.ayahNumber,
      });
    }
  }, []);

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
        {route.screen === "practice" && (
          <PracticeScreen onNavigate={handleNavigate} onBack={goBack} />
        )}
        {route.screen === "more" && <MoreScreen onNavigate={handleNavigate} onBack={goBack} />}
        {route.screen === "offline-access" && <OfflineAccessScreen onBack={goBack} />}
        {route.screen === "settings" && (
          <SettingsScreen
            onBack={goBack}
            theme={theme}
            onThemeChange={onThemeChange}
            prefs={prefs}
            onNavigate={handleNavigate}
          />
        )}
        {route.screen === "about" && <AboutScreen onBack={goBack} />}
        {route.screen === "progress" && <ProgressScreen onNavigate={handleNavigate} />}
        {route.screen === "understand" && (
          <UnderstandScreen
            surahNumber={route.surahNumber}
            ayahNumber={route.ayahNumber}
            onNavigate={handleNavigate}
            onBack={goBack}
          />
        )}
        {route.screen === "reflect" && (
          <ReflectScreen
            key={`${route.surahNumber ?? ""}:${route.ayahNumber ?? ""}`}
            surahNumber={route.surahNumber}
            ayahNumber={route.ayahNumber}
            onNavigate={handleNavigate}
            onBack={goBack}
          />
        )}
        {route.screen === "memorize" && <MemorizeScreen onNavigate={handleNavigate} />}
      </div>
      <TabBar active={state.tab} onSelect={handleSelectTab} />
    </div>
  );
}
