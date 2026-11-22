import { useMemo } from "react";
import { AppBar } from "../AppBar";
import { useDb } from "../DbContext";
import { listSurahs } from "../db";
import { useI18n } from "../i18n";
import {
  getAyahBookmarks,
  getFavoriteSurahs,
  getReadingPosition,
  getReflections,
} from "../local-store";
import type { Route } from "../navigation";

/** Your Journey (Design Lock v1.0 mobile reference, screen 10).
 *
 * Only facts this app really records are shown: the last reading position,
 * how many ayahs are bookmarked, how many surahs are favorited and how many
 * reflections were written -- all local to this device. Lesson completion
 * and memorization are NOT persisted anywhere in this app yet, so those rows
 * say "Not tracked yet" instead of showing a made-up number. The reference's
 * "42% overall progress" has no honest source, so the ring shows position
 * within the last-read surah, which is exactly what the Reader records. */
export function ProgressScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d, locale } = useI18n();
  const { db } = useDb();
  const surahs = useMemo(() => listSurahs(db), [db]);
  const position = getReadingPosition();
  const surah = position ? surahs.find((s) => s.number === position.surahNumber) : undefined;
  const hasPosition = Boolean(position && surah);

  const fraction = hasPosition ? Math.min(1, position!.ayahNumber / surah!.ayah_count) : 0;
  const percent = Math.round(fraction * 100);
  const R = 52;
  const C = 2 * Math.PI * R;

  const surahLabel = surah
    ? locale === "ar"
      ? surah.name_ar
      : locale === "fr"
        ? (surah.name_fr ?? surah.name_en)
        : surah.name_en
    : "";

  const rows: { key: string; label: string; value: string }[] = [
    {
      key: "bookmarks",
      label: d.journey.ayahsBookmarked,
      value: String(getAyahBookmarks().length),
    },
    { key: "favorites", label: d.journey.surahsFavorited, value: String(getFavoriteSurahs().size) },
    { key: "reflections", label: d.journey.reflections, value: String(getReflections().length) },
    { key: "lessons", label: d.journey.lessonsCompleted, value: d.journey.notTracked },
    { key: "memorized", label: d.journey.ayahsMemorized, value: d.journey.notTracked },
  ];

  return (
    <div className="stagger" data-testid="progress-screen">
      <AppBar title={d.journey.title} />

      <section className="card journey-ring-card" data-testid="journey-position">
        <svg
          width="132"
          height="132"
          viewBox="0 0 132 132"
          role="img"
          aria-label={
            hasPosition
              ? d.journey.ringLabel.replace("{surah}", surahLabel) + `: ${percent}%`
              : d.journey.noPosition
          }
        >
          <circle cx="66" cy="66" r={R} className="ring-track" />
          {percent > 0 && (
            <circle
              cx="66"
              cy="66"
              r={R}
              className="ring-fill"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fraction)}
              transform="rotate(-90 66 66)"
            />
          )}
          <text x="66" y="72" textAnchor="middle" className="ring-text">
            {hasPosition ? `${percent}%` : "—"}
          </text>
        </svg>
        <div>
          <div className="setting-hint">{d.journey.lastPosition}</div>
          {hasPosition ? (
            <>
              <div className="setting-title" data-testid="journey-surah">
                {surahLabel} {position!.surahNumber}:{position!.ayahNumber}
              </div>
              <div className="setting-hint">
                {d.journey.ayahOf
                  .replace("{n}", String(position!.ayahNumber))
                  .replace("{total}", String(surah!.ayah_count))}
              </div>
              <button
                type="button"
                className="chip"
                style={{ marginTop: 10, cursor: "pointer", border: 0 }}
                onClick={() =>
                  onNavigate({
                    screen: "reading",
                    surahNumber: position!.surahNumber,
                    targetAyahNumber: position!.ayahNumber,
                  })
                }
                data-testid="journey-continue"
              >
                {d.journey.continueReading}
              </button>
            </>
          ) : (
            <>
              <div className="setting-title" data-testid="journey-empty">
                {d.journey.noPosition}
              </div>
              <div className="setting-hint">{d.journey.noPositionBody}</div>
            </>
          )}
        </div>
      </section>

      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        {rows.map((r) => (
          <div key={r.key} className="setting-row" data-testid={`journey-row-${r.key}`}>
            <span className="setting-title">{r.label}</span>
            <span
              className={r.value === d.journey.notTracked ? "text-muted" : "setting-title"}
              data-testid={`journey-value-${r.key}`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <p className="setting-hint" style={{ margin: "12px 4px" }}>
        {d.journey.savedOnDevice}
      </p>
    </div>
  );
}
