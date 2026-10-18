import { useI18n } from "../i18n";
import { AppBar } from "../AppBar";
import {
  getStoredTheme,
  setStoredTheme,
  getStoredTextSize,
  setStoredTextSize,
  type ThemePreference,
  type TextSize,
} from "../local-store";

/** Mockup panel 12: Settings. The "Audio" section (Reciter / Download
 * Audio) is omitted entirely -- Phase 1 excludes downloadable audio per
 * the approved decisions, and there is no reciter data bundled offline to
 * show truthfully. Translations is a read-only row (Pickthall/Kazimirski
 * are the only certified sources bundled; there is nothing to switch
 * between yet). */
export function SettingsScreen({
  onBack,
  theme,
  onThemeChange,
}: {
  onBack: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const { d, locale, setLocale } = useI18n();
  const textSize = getStoredTextSize();

  function cycleTheme() {
    const order: ThemePreference[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length]!;
    setStoredTheme(next);
    onThemeChange(next);
  }

  function cycleTextSize() {
    const order: TextSize[] = ["small", "medium", "large"];
    const next = order[(order.indexOf(textSize) + 1) % order.length]!;
    setStoredTextSize(next);
  }

  const themeLabel =
    theme === "light" ? d.settings.themeLight : theme === "dark" ? d.settings.themeDark : "System";
  const textSizeLabel =
    textSize === "small"
      ? d.settings.textSizeSmall
      : textSize === "large"
        ? d.settings.textSizeLarge
        : d.settings.textSizeMedium;

  return (
    <div>
      <AppBar title={d.settings.title} onBack={onBack} />

      <h2
        className="text-muted"
        style={{ fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 8 }}
      >
        {d.settings.language}
      </h2>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => setLocale(locale === "en" ? "fr" : "en")}
        >
          <span style={{ fontWeight: 600 }}>{d.settings.language}</span>
          <span className="text-muted">{locale === "en" ? "English" : "Français"}</span>
        </div>
        <div className="list-row" style={{ padding: 14, cursor: "default" }}>
          <span style={{ fontWeight: 600 }}>{d.settings.translations}</span>
          <span className="text-muted" style={{ fontSize: "0.8rem", textAlign: "right" }}>
            English (Pickthall)
            <br />
            French (Kazimirski)
          </span>
        </div>
      </div>

      <h2
        className="text-muted"
        style={{ fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 8 }}
      >
        Appearance
      </h2>
      <div className="card" style={{ padding: 0 }}>
        <div className="list-row" style={{ padding: 14 }} onClick={cycleTextSize}>
          <span style={{ fontWeight: 600 }}>{d.settings.textSize}</span>
          <span className="text-muted">{textSizeLabel}</span>
        </div>
        <div className="list-row" style={{ padding: 14 }} onClick={cycleTheme}>
          <span style={{ fontWeight: 600 }}>{d.settings.theme}</span>
          <span className="text-muted">{themeLabel}</span>
        </div>
      </div>
    </div>
  );
}
