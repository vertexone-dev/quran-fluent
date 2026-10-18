import { useI18n } from "../i18n";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

/** Mockup panels 9/10 (Memorization, Audio Playback) are deliberately not
 * built in Phase 1 (approved decision #2) -- the Memorization row below is
 * visible but disabled, labeled exactly "Coming Soon". */
export function MoreScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d } = useI18n();
  return (
    <div>
      <AppBar title={d.nav.more} />
      <div className="card" style={{ padding: 0 }}>
        <div className="list-row" style={{ padding: 14, opacity: 0.55, cursor: "default" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>🧠</span>
            <span style={{ fontWeight: 600 }}>{d.more.memorization}</span>
          </div>
          <span className="chip chip-muted">{d.more.comingSoon}</span>
        </div>
        <div
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => onNavigate({ screen: "offline-access" })}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>✓</span>
            <span style={{ fontWeight: 600 }}>{d.more.offlineAccess}</span>
          </div>
          <span>→</span>
        </div>
        <div
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => onNavigate({ screen: "settings" })}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>⚙</span>
            <span style={{ fontWeight: 600 }}>{d.more.settings}</span>
          </div>
          <span>→</span>
        </div>
      </div>
    </div>
  );
}
