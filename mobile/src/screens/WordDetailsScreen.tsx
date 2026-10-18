import { useMemo } from "react";
import { useI18n } from "../i18n";
import { useDb } from "../DbContext";
import { getWordById, getRelatedWordsByRoot } from "../db";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

/** Mockup panel 5: Word Details. "Part of Speech" is deliberately omitted
 * per the approved Phase 1 decision -- word_frequency has no backing
 * column for it, and this app never invents linguistic information. Root
 * now takes the full-width row the mockup split between Root/Part of
 * Speech. */
export function WordDetailsScreen({
  wordId,
  onNavigate,
  onBack,
}: {
  wordId: string;
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d, locale } = useI18n();
  const { db } = useDb();

  const word = useMemo(() => getWordById(db, wordId, locale), [db, wordId, locale]);
  const related = useMemo(
    () => (word?.root ? getRelatedWordsByRoot(db, word.root, word.id, locale) : []),
    [db, word, locale],
  );

  if (!word) {
    return (
      <div>
        <AppBar title={d.word.title} onBack={onBack} />
        <p className="text-muted">—</p>
      </div>
    );
  }

  return (
    <div>
      <AppBar title={d.word.title} onBack={onBack} />

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div className="arabic-text" style={{ fontSize: "2.5rem", marginBottom: 6 }}>
          {word.word}
        </div>
        {word.transliteration && (
          <div className="text-muted" style={{ fontStyle: "italic" }}>
            {word.transliteration}
          </div>
        )}
      </div>

      {word.root && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
            {d.word.root}
          </div>
          <div className="arabic-text" style={{ fontSize: "1.3rem", letterSpacing: "0.3em" }}>
            {word.root}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
          {d.word.meaning}
        </div>
        <div style={{ fontWeight: 700 }}>{word.resolvedMeaning}</div>
      </div>

      {word.occurrences != null && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
            {d.word.occurrences}
          </div>
          <div style={{ fontWeight: 700 }}>{word.occurrences}</div>
        </div>
      )}

      {word.example_ayah && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="text-muted" style={{ fontSize: "0.75rem", marginBottom: 4 }}>
            {d.word.example}
          </div>
          <div className="quran-text" style={{ fontSize: "1.1rem", marginBottom: 4 }}>
            {word.example_ayah}
          </div>
          {word.example_reference && (
            <div className="text-muted" style={{ fontSize: "0.78rem" }}>
              {word.example_reference}
            </div>
          )}
        </div>
      )}

      {related.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: "1rem", marginBottom: 8 }}>{d.word.relatedWords}</h2>
          <div className="card" style={{ padding: 0 }}>
            {related.map((w) => (
              <div
                key={w.id}
                className="list-row"
                style={{ padding: "12px" }}
                onClick={() => onNavigate({ screen: "word-details", wordId: w.id })}
              >
                <div>
                  <div className="arabic-text" style={{ fontSize: "1.1rem" }}>
                    {w.word}
                  </div>
                </div>
                <div style={{ fontSize: "0.85rem" }}>{w.resolvedMeaning}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
