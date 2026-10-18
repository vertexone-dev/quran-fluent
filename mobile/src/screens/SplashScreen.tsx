import { useI18n } from "../i18n";

/** Mockup panel 1: dark forest-green hero screen with the tree-and-book
 * logo, wordmark, and taglines. Shown briefly while the bundled content
 * database loads from local assets (no network). */
export function SplashScreen() {
  const { d } = useI18n();
  return (
    <div className="splash-screen">
      <img
        src="/quranroots-logo.png"
        alt={d.brand.logoAlt}
        style={{ height: 140, width: "auto" }}
      />
      <div className="brand-name">{d.brand.name}</div>
      <div className="brand-tagline">{d.brand.tagline}</div>
      <div style={{ width: "60%", marginTop: 24 }}>
        <div className="progress-track" style={{ background: "rgba(255,255,255,0.18)" }}>
          <div className="progress-fill" style={{ width: "70%", background: "var(--gold)" }} />
        </div>
      </div>
    </div>
  );
}
