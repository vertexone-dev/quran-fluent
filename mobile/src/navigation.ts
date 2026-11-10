/** The five primary destinations (Design Lock v1.0, same order as the
 * website's primary nav). Reflect and Memorize are Planned until D-2. */
export type Tab = "home" | "quran" | "learn" | "reflect" | "memorize";

export const PLANNED_TABS: ReadonlySet<Tab> = new Set(["reflect", "memorize"]);

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
  | { screen: "reflect" }
  | { screen: "memorize" };

export const TAB_HOME_ROUTE: Record<Tab, Route> = {
  home: { screen: "home" },
  quran: { screen: "surah-list" },
  learn: { screen: "lessons" },
  reflect: { screen: "reflect" },
  memorize: { screen: "memorize" },
};
