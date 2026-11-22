/** The five primary destinations (Design Lock v1.0 mobile reference and the
 * Settings reference: Home, Quran, Learn, Progress, Settings -- QR-DESIGN-002
 * decision). Reflect, Memorize and Understand This Ayah are reached from
 * Home, the reader and Profile & More, not from the tab bar. */
export type Tab = "home" | "quran" | "learn" | "progress" | "settings";

export type Route =
  | { screen: "home" }
  | { screen: "surah-list" }
  | { screen: "reading"; surahNumber: number; targetAyahNumber?: number }
  | { screen: "ayah-bookmarks" }
  | { screen: "word-list" }
  | { screen: "word-details"; wordId: string }
  | { screen: "lessons" }
  | { screen: "lesson-player"; lessonId: string; startAtFirstExercise?: boolean }
  | { screen: "practice" }
  | { screen: "more" }
  | { screen: "offline-access" }
  | { screen: "settings" }
  | { screen: "about" }
  | { screen: "progress" }
  | { screen: "understand"; surahNumber: number; ayahNumber: number }
  | { screen: "reflect"; surahNumber?: number; ayahNumber?: number }
  | { screen: "memorize" };

export const TAB_HOME_ROUTE: Record<Tab, Route> = {
  home: { screen: "home" },
  quran: { screen: "surah-list" },
  learn: { screen: "lessons" },
  progress: { screen: "progress" },
  settings: { screen: "settings" },
};
