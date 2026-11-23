import { BookOpen, Brain, CheckSquare, ChevronRight, GraduationCap, RefreshCw } from "lucide-react";
import { AppBar } from "../AppBar";
import { art } from "../artwork";
import { useI18n } from "../i18n";
import type { Route } from "../navigation";

/** Memorize (Design Lock v1.0 mobile reference, screen 9), as an honest
 * non-functional state. There is no memorization data model, spaced
 * repetition or progress store in this app, so nothing here is interactive
 * and no percentage, surah or count is shown: the reference's "Surah Al-Mulk
 * 65%" would be invented. The three action tiles keep the reference layout
 * but are disabled and labelled. */
export function MemorizeScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d } = useI18n();
  const image = art("mosque");
  const tiles = [
    { key: "memorize", icon: Brain, title: d.memorizeUi.memorize, hint: d.memorizeUi.memorizeHint },
    { key: "revise", icon: RefreshCw, title: d.memorizeUi.revise, hint: d.memorizeUi.reviseHint },
    { key: "test", icon: CheckSquare, title: d.memorizeUi.test, hint: d.memorizeUi.testHint },
  ];
  return (
    <div className="stagger" data-testid="memorize-screen">
      <AppBar title={d.memorizeUi.title} />
      <section className="planned-hero">
        {image && <img src={image} alt="" aria-hidden="true" />}
        <span className="chip chip-planned" data-testid="memorize-badge">
          {d.memorizeUi.badge}
        </span>
        <h2 style={{ marginTop: 10 }}>{d.memorizeUi.title}</h2>
      </section>
      <p
        className="text-muted"
        style={{ margin: "16px 2px", lineHeight: 1.6 }}
        data-testid="memorize-body"
      >
        {d.memorizeUi.body}
      </p>
      <div className="tile-grid tile-grid-three">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            className="tile tile-accent"
            disabled
            aria-disabled="true"
            data-testid={`memorize-tile-${t.key}`}
          >
            <t.icon size={22} />
            <span className="tile-title">{t.title}</span>
            <span className="tile-subtitle">{t.hint}</span>
          </button>
        ))}
      </div>
      <h3 className="group-label" style={{ marginTop: 22 }}>
        {d.memorizeUi.availableNow}
      </h3>
      <div className="card" style={{ padding: 0 }}>
        <button
          type="button"
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => onNavigate({ screen: "surah-list" })}
          data-testid="memorize-open-quran"
        >
          <span className="row-icon">
            <BookOpen size={18} />
            {d.memorizeUi.openQuran}
          </span>
          <ChevronRight size={18} className="text-muted dir-icon" />
        </button>
        <button
          type="button"
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => onNavigate({ screen: "lessons" })}
          data-testid="memorize-open-learn"
        >
          <span className="row-icon">
            <GraduationCap size={18} />
            {d.memorizeUi.openLearn}
          </span>
          <ChevronRight size={18} className="text-muted dir-icon" />
        </button>
      </div>
    </div>
  );
}
