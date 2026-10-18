import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { listCourses, listLevels, listModules, listLessons } from "../db";
import type { Route } from "../navigation";

/** Mockup panel 2: Home. "Continue Learning" links to the real first lesson
 * of the real first level/module (no fabricated progress numbers -- Phase 1
 * keeps lesson-player position in-memory only, so there is no persisted
 * "resume where you left off" state to show here yet). */
export function HomeScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d, locale } = useI18n();
  const { db } = useDb();

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

  return (
    <div>
      <div className="appbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/quranroots-logo.png" alt="" width={28} height={28} style={{ height: 28 }} />
          <h1 className="appbar-title">{d.brand.name}</h1>
        </div>
        <button
          className="back-button"
          style={{ fontSize: "1.2rem" }}
          onClick={() => onNavigate({ screen: "settings" })}
          type="button"
          aria-label={d.settings.title}
        >
          ⚙
        </button>
      </div>

      {firstLevel && firstLesson && (
        <button
          className="card"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            border: "none",
            width: "100%",
            textAlign: "left",
            cursor: "pointer",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
          onClick={() => onNavigate({ screen: "lesson-player", lessonId: firstLesson.id })}
          type="button"
        >
          <div>
            <div style={{ fontSize: "0.78rem", opacity: 0.85, marginBottom: 4 }}>
              {d.home.startLearning}
            </div>
            <div style={{ fontWeight: 700 }}>
              {d.lessons.level} {firstLevel.number} · {firstLevel.title}
            </div>
            <div style={{ fontSize: "0.78rem", opacity: 0.85, marginTop: 4 }}>
              {totalLessonsInLevel} {d.lessons.title.toLowerCase()}
            </div>
          </div>
          <span style={{ fontSize: "1.3rem" }}>→</span>
        </button>
      )}

      <div className="tile-grid">
        <button
          className="tile tile-support"
          onClick={() => onNavigate({ screen: "surah-list" })}
          type="button"
        >
          <span className="tile-icon">📖</span>
          <span className="tile-title">{d.nav.quran}</span>
          <span className="tile-subtitle">{d.reader.tileSubtitle}</span>
        </button>
        <button
          className="tile tile-primary-tint"
          onClick={() => onNavigate({ screen: "lessons" })}
          type="button"
        >
          <span className="tile-icon">🎓</span>
          <span className="tile-title">{d.nav.lessons}</span>
          <span className="tile-subtitle">{course?.title ?? ""}</span>
        </button>
        <button
          className="tile tile-gold"
          onClick={() => onNavigate({ screen: "practice" })}
          type="button"
        >
          <span className="tile-icon">✎</span>
          <span className="tile-title">{d.nav.practice}</span>
          <span className="tile-subtitle">{d.practice.subtitle}</span>
        </button>
        <button className="tile tile-rose" disabled type="button">
          <span className="tile-icon">🧠</span>
          <span className="tile-title">{d.more.memorization}</span>
          <span className="tile-subtitle">{d.more.comingSoon}</span>
        </button>
      </div>

      <button
        className="card"
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
        onClick={() => onNavigate({ screen: "offline-access" })}
        type="button"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--primary)", fontSize: "1.2rem" }}>✓</span>
          <div>
            <div style={{ fontWeight: 700 }}>{d.offline.title}</div>
            <div className="text-muted" style={{ fontSize: "0.8rem" }}>
              {d.offline.upToDate}
            </div>
          </div>
        </div>
        <span>→</span>
      </button>
    </div>
  );
}
