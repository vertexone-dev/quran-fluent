import { useI18n } from "../i18n";
import { EMBLEM_LARGE_SRC } from "../artwork";

/** Shown briefly while the bundled content database loads from local
 * assets (no network). Design Lock v1.0: emblem on Midnight Teal. The bar
 * is a decorative loading indicator, not a progress measurement. */
export function SplashScreen() {
  const { d } = useI18n();
  return (
    <div className="splash-screen" data-testid="splash-screen">
      <img
        src={EMBLEM_LARGE_SRC}
        alt={d.brand.logoAlt}
        style={{ width: "min(62vw, 280px)", height: "auto" }}
      />
      <div className="brand-name">{d.brand.name}</div>
      <div className="brand-tagline">{d.brand.tagline}</div>
      <div style={{ width: "50%", marginTop: 24 }} role="status" aria-label={d.common.loading}>
        <div className="progress-track" style={{ background: "oklch(0.974 0.01 87.5 / 14%)" }}>
          <div className="progress-fill" style={{ width: "70%", background: "var(--qr-gold)" }} />
        </div>
      </div>
    </div>
  );
}
