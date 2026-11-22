import { BookOpen, GraduationCap, Languages, Layers } from "lucide-react";
import { EMBLEM_LARGE_SRC } from "../artwork";
import { nextLocale, useI18n } from "../i18n";

/** First-launch welcome (Design Lock v1.0 mobile reference, screen 2). Three
 * truthful feature rows only: everything named here exists in this app. The
 * reference's "Grow in Faith" and "Family" copy is deliberately not used,
 * because neither is implemented. A language button lets the user choose
 * EN/FR/AR before starting. Shown once; the flag lives in local-store. */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { d, locale, setLocale } = useI18n();
  const rows = [
    { icon: BookOpen, title: d.onboarding.readTitle, body: d.onboarding.readBody },
    { icon: Layers, title: d.onboarding.understandTitle, body: d.onboarding.understandBody },
    { icon: GraduationCap, title: d.onboarding.learnTitle, body: d.onboarding.learnBody },
  ];
  return (
    <main className="onboarding" data-testid="onboarding-screen">
      <div className="onboarding-top">
        <button
          type="button"
          className="icon-btn icon-btn-bordered"
          onClick={() => setLocale(nextLocale(locale))}
          aria-label={d.settings.language}
          data-testid="onboarding-language"
        >
          <Languages size={18} />
          <span style={{ marginInlineStart: 6 }}>{locale.toUpperCase()}</span>
        </button>
      </div>
      <img className="onboarding-emblem" src={EMBLEM_LARGE_SRC} alt={d.brand.logoAlt} />
      <h1 className="onboarding-title">{d.onboarding.title}</h1>
      <p className="onboarding-subtitle">{d.onboarding.subtitle}</p>
      <ul className="onboarding-list">
        {rows.map((r) => (
          <li key={r.title} className="onboarding-row">
            <span className="row-icon" aria-hidden="true">
              <r.icon size={22} />
            </span>
            <span>
              <span className="setting-title">{r.title}</span>
              <span className="setting-hint" style={{ display: "block" }}>
                {r.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="onboarding-note">{d.onboarding.freeNote}</p>
      <button
        type="button"
        className="btn-gold onboarding-cta"
        onClick={onDone}
        data-testid="onboarding-start"
      >
        {d.onboarding.getStarted}
      </button>
      <button
        type="button"
        className="onboarding-skip"
        onClick={onDone}
        data-testid="onboarding-skip"
      >
        {d.onboarding.skip}
      </button>
    </main>
  );
}
