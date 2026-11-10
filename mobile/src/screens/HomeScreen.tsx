import {
  Bookmark,
  BookOpen,
  Brain,
  ChevronRight,
  CloudOff,
  GraduationCap,
  Languages,
  Moon,
  PenLine,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { nextLocale, useI18n } from "../i18n";
import { art } from "../artwork";
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
  const { d, locale, contentLocale, setLocale } = useI18n();
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

  const courses = listCourses(db, contentLocale);
  const course = courses[0];
  const levels = listLevels(db, contentLocale);
  const firstLevel = levels[0];
  const firstModule = firstLevel ? listModules(db, firstLevel.id, contentLocale)[0] : undefined;
  const firstLessons = firstModule ? listLessons(db, firstModule.id, contentLocale) : [];
  const firstLesson = firstLessons[0];
  const totalLessonsInLevel = firstLevel
    ? listModules(db, firstLevel.id, contentLocale).reduce(
        (sum, m) => sum + listLessons(db, m.id, contentLocale).length,
        0,
      )
    : 0;

  const { surah: readingCardSurah, isContinuing } = pickReadingCardSurah(
    listSurahs(db),
    getLastReadSurah(),
  );

  const heroArt = art("hero");
  const shortcuts = [
    {
      key: "bookmarks",
      icon: Bookmark,
      label: d.more.bookmarks,
      route: { screen: "ayah-bookmarks" },
    },
    { key: "practice", icon: PenLine, label: d.more.practice, route: { screen: "practice" } },
    {
      key: "offline",
      icon: CloudOff,
      label: d.more.offlineAccess,
      route: { screen: "offline-access" },
    },
    { key: "settings", icon: SettingsIcon, label: d.more.settings, route: { screen: "settings" } },
  ] as const;

  return (
    <div className="stagger" data-testid="home-screen">
      <section className="brand-hero" data-testid="home-brand-hero">
        {heroArt && <img className="brand-hero-art" src={heroArt} alt="" aria-hidden="true" />}
        <div className="appbar" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Logo showWordmark={false} size={34} />
            <h1 className="appbar-title">{d.brand.name}</h1>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className="icon-btn icon-btn-bordered icon-btn-glass lang-btn"
              onClick={() => setLocale(nextLocale(locale))}
              aria-label={d.settings.language}
              data-testid="home-language-toggle"
            >
              <Languages size={16} />
              <span>{locale.toUpperCase()}</span>
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-bordered icon-btn-glass"
              onClick={cycleTheme}
              aria-label={`${d.settings.theme}: ${nextThemeLabel}`}
              data-testid="home-theme-toggle"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="profile-btn"
              onClick={() => onNavigate({ screen: "more" })}
              aria-label={d.more.open}
              data-testid="profile-button"
            >
              <UserRound size={18} />
            </button>
          </div>
        </div>

        <p className="eyebrow">{d.home.greeting}</p>
        <p className="tagline">{d.brand.tagline}</p>
      </section>

      {readingCardSurah && (
        <button
          type="button"
          className="hero-card"
          onClick={() => onNavigate({ screen: "reading", surahNumber: readingCardSurah.number })}
          data-testid="home-reading-card"
        >
          <div className="hero-pattern" aria-hidden="true" />
          <div className="hero-top">
            <span className="hero-label">
              {isContinuing ? d.home.continueReading : d.home.startReading}
            </span>
            <ChevronRight size={20} className="dir-icon" />
          </div>
          <div className="hero-body">
            <div>
              <div className="hero-title">{readingCardSurah.name_en}</div>
              <div className="hero-sub">
                {readingCardSurah.ayah_count} {d.offline.unitAyahs}
              </div>
            </div>
            <div className="quran-text hero-ar">{readingCardSurah.name_ar}</div>
          </div>
        </button>
      )}

      <SectionTitle>{d.home.shortcuts}</SectionTitle>
      <div className="shortcut-row" data-testid="home-shortcuts">
        {shortcuts.map((s) => (
          <button
            key={s.key}
            type="button"
            className="shortcut"
            onClick={() => onNavigate(s.route)}
            data-testid={`home-shortcut-${s.key}`}
          >
            <s.icon size={20} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>

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
          data-testid="home-learning-card"
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
            <ChevronRight size={20} className="text-muted dir-icon" />
          </div>
        </button>
      ) : (
        <div className="card text-muted" data-testid="home-learning-empty">
          {d.home.startLearning}
        </div>
      )}

      <SectionTitle>{d.home.explore}</SectionTitle>
      <div className="tile-grid">
        <button
          className="tile tile-support"
          onClick={() => onNavigate({ screen: "surah-list" })}
          type="button"
          data-testid="home-tile-quran"
        >
          <BookOpen size={22} />
          <span className="tile-title">{d.nav.quran}</span>
          <span className="tile-subtitle">{d.reader.tileSubtitle}</span>
        </button>
        <button
          className="tile tile-primary-tint"
          onClick={() => onNavigate({ screen: "lessons" })}
          type="button"
          data-testid="home-tile-learn"
        >
          <GraduationCap size={22} />
          <span className="tile-title">{d.nav.learn}</span>
          <span className="tile-subtitle">{course?.title ?? d.nav.lessons}</span>
        </button>
        <button
          className="tile tile-gold"
          onClick={() => onNavigate({ screen: "reflect" })}
          type="button"
          data-testid="home-tile-reflect"
        >
          <Sparkles size={22} />
          <span className="tile-title">{d.nav.reflect}</span>
          <span className="chip chip-planned">{d.planned.badge}</span>
        </button>
        <button
          className="tile tile-accent"
          onClick={() => onNavigate({ screen: "memorize" })}
          type="button"
          data-testid="home-tile-memorize"
        >
          <Brain size={22} />
          <span className="tile-title">{d.nav.memorize}</span>
          <span className="chip chip-planned">{d.planned.badge}</span>
        </button>
      </div>
    </div>
  );
}
