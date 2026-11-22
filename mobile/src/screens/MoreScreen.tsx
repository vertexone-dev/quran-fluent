import {
  Bookmark,
  Brain,
  ChevronRight,
  CloudOff,
  PenLine,
  Settings as SettingsIcon,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "../i18n";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";

type Row = { key: string; icon: LucideIcon; label: string; route: Route; badge?: string };

/** Profile & More (opened from the profile circle on Home). Keeps every
 * secondary feature one tap away now that the tab bar carries the five
 * primary destinations. There are no accounts in the offline app, so the
 * profile card only states where data lives -- no invented name or stats. */
export function MoreScreen({
  onNavigate,
  onBack,
}: {
  onNavigate: (route: Route) => void;
  onBack: () => void;
}) {
  const { d } = useI18n();
  const study: Row[] = [
    {
      key: "bookmarks",
      icon: Bookmark,
      label: d.more.bookmarks,
      route: { screen: "ayah-bookmarks" },
    },
    { key: "practice", icon: PenLine, label: d.more.practice, route: { screen: "practice" } },
    { key: "reflect", icon: Sparkles, label: d.nav.reflect, route: { screen: "reflect" } },
    {
      key: "memorize",
      icon: Brain,
      label: d.more.memorization,
      route: { screen: "memorize" },
      badge: d.memorizeUi.badge,
    },
  ];
  const app: Row[] = [
    {
      key: "offline-access",
      icon: CloudOff,
      label: d.more.offlineAccess,
      route: { screen: "offline-access" },
    },
    { key: "settings", icon: SettingsIcon, label: d.more.settings, route: { screen: "settings" } },
  ];
  const renderRows = (rows: Row[]) =>
    rows.map((r) => (
      <button
        key={r.key}
        type="button"
        className="list-row"
        style={{ padding: 14 }}
        onClick={() => onNavigate(r.route)}
        data-testid={`more-row-${r.key}`}
      >
        <span className="row-icon">
          <r.icon size={18} />
          {r.label}
        </span>
        {r.badge ? (
          <span className="chip chip-planned">{r.badge}</span>
        ) : (
          <ChevronRight size={18} className="text-muted dir-icon" />
        )}
      </button>
    ));

  return (
    <div className="stagger" data-testid="more-screen">
      <AppBar title={d.more.title} onBack={onBack} />

      <div
        className="card row"
        style={{ gap: 14, marginBottom: 22 }}
        data-testid="offline-profile-card"
      >
        <span className="profile-btn" aria-hidden="true" style={{ width: 48, height: 48 }}>
          <UserRound size={22} />
        </span>
        <div>
          <div className="row-title">{d.more.offlineProfile}</div>
          <div className="text-muted small" style={{ marginTop: 2 }}>
            {d.more.offlineProfileBody}
          </div>
        </div>
      </div>

      <h2 className="group-label">{d.more.study}</h2>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        {renderRows(study)}
      </div>

      <h2 className="group-label">{d.more.app}</h2>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        {renderRows(app)}
      </div>
    </div>
  );
}
