import { BookOpen, Brain, ChevronRight, GraduationCap, Languages, Moon, PenLine, Sun } from "lucide-react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { listCourses, listLevels, listModules, listLessons, listSurahs } from "../db";
import {
  getLastReadSurah,
  nextThemePreference,
  resolveIsDark,
  setStoredTheme,
  type ThemePreference,
} from "../local-store";
import { pickReadingCardSurah } from "../home-dashboard";
import { Logo } from "../Logo";
import { SectionTitle } from "../components/ui";
import type { Route } from "../navigation";

/** Home Dashboard, Phase 1 of the Emergent UI integration. Reuses the real
 * curriculum/content queries from ../db (same source as before this phase)
 * -- nothing here is mock data. "Continue Learning" has no persisted
 * progress to show yet (lesson-player position is in-memory only, see
 * LessonPlayerScreen.tsx), so it always links to the real first lesson
 * rather than inventing a completion percentage. "Continue Reading" is
 * genuinely stateful: ReadingScreen.tsx now records the last surah opened
 * (surah-level only, see local-store.ts), and this card reflects that real
 * history or an honest "Start Reading" empty state otherwise. */
export function HomeScreen({
  onNavigate,
  theme,
  onThemeChange,
  prefersDark,
}: {
  onNavigate: (route: Route) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  prefersDark: boolean;
}) {
  const { d, locale, setLocale } = useI18n();
  const { db } = useDb();

  function cycleTheme() {
    const next = nextThemePreference(theme);
    setStoredTheme(next);
    onThemeChange(next);
  }
  const isDark = resolveIsDark(theme, prefersDark);
  const nextTheme = nextThemePreference(theme);
  const nextThemeLabel =
    nextTheme === "light"
      ? d.settings.themeLight
      : nextTheme === "dark"
        ? d.settings.themeDark
        : d.settings.themeSystem;

  const courses = listCourses(db, locale);
  const course = courses[0];
  const levels = listLevels(db, locale);
  const firstLevel = levels[0];
  const firstModule = firstLevel ? listModules(db, firstLevel.id, locale)[0] : undefined;
  const firstLessons = firstModule ? listLessons(db, firstModule.id, locale) : [];
  const firstLesson = firstLessons[0];
  const totalLessonsInLevel = firstLevel
    ? listModules(db, firstLevel.id, locale).reduce(
        (sum, m) => sum + listLessons(db, m.id, locale).length,
        0,
      )
    : 0;

  const { surah: readingCardSurah, isContinuing } = pickReadingCardSurah(
    listSurahs(db),
    getLastReadSurah(),
  );

  return (
    <div className="stagger">
      <div className="appbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo showWordmark={false} size={28} />
          <h1 className="appbar-title">{d.brand.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="icon-btn icon-btn-bordered lang-btn"
            onClick={() => setLocale(locale === "en" ? "fr" : "en")}
            aria-label={d.settings.language}
          >
            <Languages size={16} />
            <span>{locale.toUpperCase()}</span>
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-bordered"
            onClick={cycleTheme}
            aria-label={`${d.settings.theme}: ${nextThemeLabel}`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <p className="eyebrow">{d.home.greeting}</p>
      <p className="tagline">{d.brand.tagline}</p>

      {readingCardSurah && (
        <button
          type="button"
          className="hero-card"
          onClick={() => onNavigate({ screen: "reading", surahNumber: readingCardSurah.number })}
        >
          <div className="hero-pattern" aria-hidden="true" />
          <div className="hero-top">
            <span className="hero-label">
              {isContinuing ? d.home.continueReading : d.home.startReading}
            </span>
            <ChevronRight size={20} />
          </div>
          <div className="hero-body">
            <div>
              <div className="hero-title">{readingCardSurah.name_en}</div>
              <div className="hero-sub">
                {readingCardSurah.ayah_count} {locale === "fr" ? "versets" : "ayahs"}
              </div>
            </div>
            <div className="quran-text hero-ar">{readingCardSurah.name_ar}</div>
          </div>
        </button>
      )}

      {/* Always "Start Learning", never "Continue Learning": lesson-player
          position is in-memory only (see LessonPlayerScreen.tsx), so there
          is no real signal -- unlike the reading card's isContinuing above
          -- that would make "continuing" a true statement here. */}
      <SectionTitle>{d.home.startLearning}</SectionTitle>
      {firstLevel && firstLesson ? (
        <button
          type="button"
          className="card card-button"
          onClick={() => onNavigate({ screen: "lesson-player", lessonId: firstLesson.id })}
        >
          <div className="row-between">
            <div className="row" style={{ gap: 12 }}>
              <span className="level-medallion">{firstLevel.number}</span>
              <div>
                <div className="row-title">{firstLesson.title}</div>
                <div className="text-muted small">
                  {d.lessons.level} {firstLevel.number} · {totalLessonsInLevel}{" "}
                  {d.lessons.title.toLowerCase()}
                </div>
              </div>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </div>
        </button>
      ) : (
        <div className="card text-muted">{d.home.startLearning}</div>
      )}

      <SectionTitle>{d.home.explore}</SectionTitle>
      <div className="tile-grid">
        <button
          className="tile tile-support"
          onClick={() => onNavigate({ screen: "surah-list" })}
          type="button"
        >
          <BookOpen size={22} />
          <span className="tile-title">{d.nav.quran}</span>
          <span className="tile-subtitle">{d.reader.tileSubtitle}</span>
        </button>
        <button
          className="tile tile-primary-tint"
          onClick={() => onNavigate({ screen: "lessons" })}
          type="button"
        >
          <GraduationCap size={22} />
          <span className="tile-title">{d.nav.lessons}</span>
          <span className="tile-subtitle">{course?.title ?? ""}</span>
        </button>
        <button
          className="tile tile-gold"
          onClick={() => onNavigate({ screen: "practice" })}
          type="button"
        >
          <PenLine size={22} />
          <span className="tile-title">{d.nav.practice}</span>
          <span className="tile-subtitle">{d.practice.subtitle}</span>
        </button>
        <button className="tile tile-rose" disabled type="button">
          <Brain size={22} />
          <span className="tile-title">{d.more.memorization}</span>
          <span className="tile-subtitle">{d.more.comingSoon}</span>
        </button>
      </div>
    </div>
  );
}
