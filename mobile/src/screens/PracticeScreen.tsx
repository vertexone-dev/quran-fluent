import { useMemo } from "react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { listLevels, listModules, listLessons, getLessonForPlayer } from "../db";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

/** Mockup panel 8 (Practice Exercises): production has no standalone
 * practice bank distinct from a lesson's own lesson_exercises, so this
 * screen lists every real lesson that has at least one exercise and jumps
 * straight to its exercises (startAtFirstExercise) -- real graded content,
 * not an invented review-queue algorithm (which would need the Class-D
 * read-modify-write review_items logic the Phase 0 audit flagged as unsafe
 * to build offline yet). */
export function PracticeScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d, locale } = useI18n();
  const { db } = useDb();

  const entries = useMemo(() => {
    const levels = listLevels(db, locale);
    const rows: { lessonId: string; title: string; levelTitle: string; exerciseCount: number }[] =
      [];
    for (const level of levels) {
      for (const moduleRow of listModules(db, level.id, locale)) {
        for (const lesson of listLessons(db, moduleRow.id, locale)) {
          const full = getLessonForPlayer(db, lesson.id, locale);
          const exerciseCount = full?.exercises.length ?? 0;
          if (exerciseCount > 0) {
            rows.push({
              lessonId: lesson.id,
              title: lesson.title,
              levelTitle: level.title,
              exerciseCount,
            });
          }
        }
      }
    }
    return rows;
  }, [db, locale]);

  return (
    <div>
      <AppBar title={d.practice.title} />
      <p className="text-muted" style={{ marginBottom: 16 }}>
        {d.practice.subtitle}
      </p>

      {entries.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: "center", padding: 24 }}>
          {d.practice.empty}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {entries.map((e) => (
            <div
              key={e.lessonId}
              className="list-row"
              style={{ padding: 14 }}
              onClick={() =>
                onNavigate({
                  screen: "lesson-player",
                  lessonId: e.lessonId,
                  startAtFirstExercise: true,
                })
              }
            >
              <div>
                <div style={{ fontWeight: 600 }}>{e.title}</div>
                <div className="text-muted" style={{ fontSize: "0.78rem" }}>
                  {e.levelTitle}
                </div>
              </div>
              <span className="chip chip-muted">{e.exerciseCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
