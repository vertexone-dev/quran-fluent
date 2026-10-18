import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { AppBar } from "../AppBar";

/** Mockup panel 11: Offline Content. Every row's numbers are read live
 * from content_version/manifest-backed counts actually present in the
 * bundled database -- not hardcoded to the mockup's sample figures. */
export function OfflineAccessScreen({ onBack }: { onBack: () => void }) {
  const { d } = useI18n();
  const { db, version } = useDb();

  const counts = {
    surahs: db.exec("SELECT COUNT(*) as n FROM surahs")[0]?.values[0]?.[0] ?? 0,
    ayahs: db.exec("SELECT COUNT(*) as n FROM ayahs")[0]?.values[0]?.[0] ?? 0,
    englishRows: db.exec("SELECT COUNT(*) as n FROM translations")[0]?.values[0]?.[0] ?? 0,
    frenchSegments:
      db.exec("SELECT COUNT(*) as n FROM translation_segments")[0]?.values[0]?.[0] ?? 0,
    lessons: db.exec("SELECT COUNT(*) as n FROM lessons")[0]?.values[0]?.[0] ?? 0,
    exercises: db.exec("SELECT COUNT(*) as n FROM lesson_exercises")[0]?.values[0]?.[0] ?? 0,
  };

  const rows = [
    { label: `Arabic Qur'an (${counts.surahs} surahs)`, detail: `${counts.ayahs} ayahs` },
    { label: "English Translation (Pickthall)", detail: `${counts.englishRows} ayahs` },
    { label: "French Translation (Kazimirski)", detail: `${counts.frenchSegments} segments` },
    { label: d.offline.lessonsLabel, detail: `${counts.lessons} lessons` },
    { label: "Exercises", detail: `${counts.exercises} exercises` },
  ];

  return (
    <div>
      <AppBar title={d.offline.title} onBack={onBack} />

      <div
        className="card"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
          border: "none",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>✓</span>
          <div style={{ fontWeight: 700 }}>{d.offline.upToDate}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        {rows.map((row) => (
          <div key={row.label} className="list-row" style={{ padding: 14, cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--primary)" }}>✓</span>
              <span style={{ fontWeight: 600 }}>{row.label}</span>
            </div>
            <span className="text-muted" style={{ fontSize: "0.8rem" }}>
              {row.detail}
            </span>
          </div>
        ))}
      </div>

      {version && (
        <div className="card text-muted" style={{ fontSize: "0.78rem", fontFamily: "monospace" }}>
          {d.offline.version} {version.version} · {d.offline.generatedAt}{" "}
          {new Date(version.generated_at).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
