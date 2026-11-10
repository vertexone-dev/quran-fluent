import { BookOpen, ChevronRight, GraduationCap } from "lucide-react";
import { useI18n } from "../i18n";
import { AppBar } from "../AppBar";
import { art } from "../artwork";
import type { Route } from "../navigation";

/** Reflect and Memorize are primary destinations from D-1 but are only
 * built in D-2. This screen states that plainly -- no sample reflections,
 * no tafsir, no memorization progress -- and points to what works now. */
export function PlannedScreen({
  feature,
  onNavigate,
}: {
  feature: "reflect" | "memorize";
  onNavigate: (route: Route) => void;
}) {
  const { d } = useI18n();
  const title = feature === "reflect" ? d.nav.reflect : d.nav.memorize;
  const body = feature === "reflect" ? d.planned.reflectBody : d.planned.memorizeBody;
  const image = art(feature === "reflect" ? "night" : "mosque");
  return (
    <div className="stagger" data-testid={`planned-screen-${feature}`}>
      <AppBar title={title} />
      <section className="planned-hero">
        {image && <img src={image} alt="" aria-hidden="true" />}
        <span className="chip chip-planned" data-testid="planned-badge">
          {d.planned.badge}
        </span>
        <h2 style={{ marginTop: 10 }}>{title}</h2>
      </section>
      <p
        className="text-muted"
        style={{ margin: "16px 2px 22px", lineHeight: 1.6 }}
        data-testid="planned-body"
      >
        {body}
      </p>
      <h3 className="group-label">{d.planned.availableNow}</h3>
      <div className="card" style={{ padding: 0 }}>
        <button
          type="button"
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => onNavigate({ screen: "surah-list" })}
          data-testid="planned-open-quran"
        >
          <span className="row-icon">
            <BookOpen size={18} />
            {d.planned.openQuran}
          </span>
          <ChevronRight size={18} className="text-muted dir-icon" />
        </button>
        <button
          type="button"
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => onNavigate({ screen: "lessons" })}
          data-testid="planned-open-learn"
        >
          <span className="row-icon">
            <GraduationCap size={18} />
            {d.planned.openLearn}
          </span>
          <ChevronRight size={18} className="text-muted dir-icon" />
        </button>
      </div>
    </div>
  );
}
