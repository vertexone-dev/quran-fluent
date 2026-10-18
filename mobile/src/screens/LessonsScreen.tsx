import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { listLevels, listModules, listLessons } from "../db";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

type ViewTab = "levels" | "categories";

/** Mockup panel 6: Lessons. Drills Levels -> Modules -> Lessons using real
 * curriculum data. The mockup's "Categories" tab has no backing data model
 * in the real schema (lessons/modules have no category column -- only
 * word_frequency does, for a different screen) -- shown as an honest empty
 * state rather than invented content. */
export function LessonsScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d, locale } = useI18n();
  const { db } = useDb();
  const [tab, setTab] = useState<ViewTab>("levels");
  const [levelId, setLevelId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);

  const levels = useMemo(() => listLevels(db, locale), [db, locale]);
  const modules = useMemo(
    () => (levelId ? listModules(db, levelId, locale) : []),
    [db, levelId, locale],
  );
  const lessons = useMemo(
    () => (moduleId ? listLessons(db, moduleId, locale) : []),
    [db, moduleId, locale],
  );

  const selectedLevel = levels.find((l) => l.id === levelId);
  const selectedModule = modules.find((m) => m.id === moduleId);

  if (moduleId && selectedModule) {
    return (
      <div>
        <AppBar title={selectedModule.title} onBack={() => setModuleId(null)} />
        <div className="card" style={{ padding: 0 }}>
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="list-row"
              style={{ padding: 14 }}
              onClick={() => onNavigate({ screen: "lesson-player", lessonId: lesson.id })}
            >
              <div style={{ fontWeight: 600 }}>{lesson.title}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                {lesson.estimated_minutes} {d.lessons.minutes}
              </div>
            </div>
          ))}
          {lessons.length === 0 && (
            <div className="text-muted" style={{ padding: 16 }}>
              —
            </div>
          )}
        </div>
      </div>
    );
  }

  if (levelId && selectedLevel) {
    return (
      <div>
        <AppBar title={selectedLevel.title} onBack={() => setLevelId(null)} />
        {selectedLevel.goal && (
          <p className="text-muted" style={{ marginBottom: 16 }}>
            {selectedLevel.goal}
          </p>
        )}
        <div className="card" style={{ padding: 0 }}>
          {modules.map((m) => (
            <div
              key={m.id}
              className="list-row"
              style={{ padding: 14 }}
              onClick={() => setModuleId(m.id)}
            >
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              <span>→</span>
            </div>
          ))}
          {modules.length === 0 && (
            <div className="text-muted" style={{ padding: 16 }}>
              —
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppBar title={d.lessons.title} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={tab === "levels" ? "chip" : "chip chip-muted"}
          style={{ border: "none", cursor: "pointer" }}
          onClick={() => setTab("levels")}
        >
          Levels
        </button>
        <button
          type="button"
          className={tab === "categories" ? "chip" : "chip chip-muted"}
          style={{ border: "none", cursor: "pointer" }}
          onClick={() => setTab("categories")}
        >
          Categories
        </button>
      </div>

      {tab === "levels" ? (
        <div className="card" style={{ padding: 0 }}>
          {levels.map((level) => {
            const levelModules = listModules(db, level.id, locale);
            const lessonCount = levelModules.reduce(
              (sum, m) => sum + listLessons(db, m.id, locale).length,
              0,
            );
            return (
              <div
                key={level.id}
                className="list-row"
                style={{ padding: 14 }}
                onClick={() => setLevelId(level.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                    }}
                  >
                    {level.number}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{level.title}</div>
                    <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                      {lessonCount} {d.lessons.title.toLowerCase()}
                    </div>
                  </div>
                </div>
                <span>→</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-muted" style={{ textAlign: "center", padding: 24 }}>
          Categories aren't part of the offline content bundle in this release.
        </div>
      )}
    </div>
  );
}
