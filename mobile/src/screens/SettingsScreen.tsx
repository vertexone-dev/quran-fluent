import {
  ChevronRight,
  Download,
  Info,
  Languages,
  Moon,
  Settings as SettingsIcon,
  ShieldCheck,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "../i18n";
import { AppBar } from "../AppBar";
import type { Route } from "../navigation";
import type { TextSize, ThemePreference } from "../local-store";

/** Controls the App owns (it applies them to <html>), handed to Settings. */
export type PrefsControls = {
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
  reduceMotion: boolean;
  onReduceMotionChange: (value: boolean) => void;
  onPreferencesReset: () => void;
};

type NavRow = {
  key: string;
  testId: string;
  icon: LucideIcon;
  title: string;
  hint: string;
  route: Route;
};

/** Settings (Design Lock v1.0 "Mobile App - Settings"): one card of category
 * rows, each with a gold outline icon, a title, a one-line hint and a chevron.
 * Only categories with working controls are listed, in the reference's order:
 * General, Quran & Reading, Language, Appearance, Offline, Privacy & Data,
 * About. The reference's profile card, Audio & Recitation, Notifications and
 * Family & Children rows are intentionally absent: this offline app has no
 * accounts, audio, notifications or family features, and a row that does
 * nothing would misrepresent that. Translations stay read-only (Pickthall and
 * Kazimirski are the only bundled sources). */
export function SettingsScreen({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (route: Route) => void;
  theme?: ThemePreference;
  onThemeChange?: (theme: ThemePreference) => void;
  prefs?: PrefsControls;
}) {
  const { d } = useI18n();
  const n = d.settingsNav;
  const rows: NavRow[] = [
    {
      key: "general",
      testId: "settings-nav-general",
      icon: SettingsIcon,
      title: n.general,
      hint: n.generalHint,
      route: { screen: "settings-page", page: "general" },
    },
    {
      key: "reading",
      testId: "settings-nav-reading",
      icon: BookOpen,
      title: n.reading,
      hint: n.readingHint,
      route: { screen: "settings-page", page: "reading" },
    },
    {
      key: "language",
      testId: "settings-language-row",
      icon: Languages,
      title: n.language,
      hint: n.languageHint,
      route: { screen: "settings-page", page: "language" },
    },
    {
      key: "appearance",
      testId: "settings-nav-appearance",
      icon: Moon,
      title: n.appearance,
      hint: n.appearanceHint,
      route: { screen: "settings-page", page: "appearance" },
    },
    {
      key: "offline",
      testId: "settings-nav-offline",
      icon: Download,
      title: n.offline,
      hint: n.offlineHint,
      route: { screen: "offline-access" },
    },
    {
      key: "privacy",
      testId: "settings-nav-privacy",
      icon: ShieldCheck,
      title: n.privacy,
      hint: n.privacyHint,
      route: { screen: "settings-page", page: "privacy" },
    },
    {
      key: "about",
      testId: "setting-about",
      icon: Info,
      title: d.about.title,
      hint: d.about.hint,
      route: { screen: "about" },
    },
  ];

  return (
    <div data-testid="settings-screen">
      <AppBar centered title={d.settings.title} onBack={onBack} />
      <nav className="card settings-nav" aria-label={d.settings.title}>
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            className="settings-nav-row"
            onClick={() => onNavigate(r.route)}
            data-testid={r.testId}
          >
            <r.icon size={24} strokeWidth={1.6} className="settings-nav-icon" aria-hidden="true" />
            <span className="settings-nav-text">
              <span className="setting-title">{r.title}</span>
              <span className="setting-hint">{r.hint}</span>
            </span>
            <ChevronRight size={18} className="text-muted dir-icon" aria-hidden="true" />
          </button>
        ))}
      </nav>
    </div>
  );
}
