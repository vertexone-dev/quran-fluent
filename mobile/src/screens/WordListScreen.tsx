import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { searchWordFrequency } from "../db";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

/** Entry point into Word Details -- browses the real word_frequency
 * reference list (search by word/transliteration/meaning), since the
 * Reading View itself has no reliable per-word tap target (see
 * ReadingScreen's comment). */
export function WordListScreen({
  onNavigate,
  onBack,
}: {
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d, locale } = useI18n();
  const { db } = useDb();
  const [search, setSearch] = useState("");

  const words = useMemo(
    () => searchWordFrequency(db, { search: search || undefined, locale, limit: 100 }),
    [db, search, locale],
  );

  return (
    <div>
      <AppBar title={d.reader.words} onBack={onBack} />
      <input
        className="input"
        placeholder={d.reader.searchWords}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <div className="card" style={{ padding: 0 }}>
        {words.map((w) => (
          <div
            key={w.id}
            className="list-row"
            style={{ padding: "12px" }}
            onClick={() => onNavigate({ screen: "word-details", wordId: w.id })}
          >
            <div>
              <div className="arabic-text" style={{ fontSize: "1.2rem" }}>
                {w.word}
              </div>
              {w.transliteration && (
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                  {w.transliteration}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.88rem" }}>{w.resolvedMeaning}</div>
            </div>
          </div>
        ))}
        {words.length === 0 && (
          <div className="text-muted" style={{ padding: 16, textAlign: "center" }}>
            {d.word.noResults}
          </div>
        )}
      </div>
    </div>
  );
}
