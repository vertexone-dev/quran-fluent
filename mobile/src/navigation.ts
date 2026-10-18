export type Tab = "home" | "quran" | "lessons" | "practice" | "more";

export type Route =
  | { screen: "home" }
  | { screen: "surah-list" }
  | { screen: "reading"; surahNumber: number }
  | { screen: "word-list" }
  | { screen: "word-details"; wordId: string }
  | { screen: "lessons" }
  | { screen: "lesson-player"; lessonId: string; startAtFirstExercise?: boolean }
  | { screen: "practice" }
  | { screen: "more" }
  | { screen: "offline-access" }
  | { screen: "settings" };

export const TAB_HOME_ROUTE: Record<Tab, Route> = {
  home: { screen: "home" },
  quran: { screen: "surah-list" },
  lessons: { screen: "lessons" },
  practice: { screen: "practice" },
  more: { screen: "more" },
};
