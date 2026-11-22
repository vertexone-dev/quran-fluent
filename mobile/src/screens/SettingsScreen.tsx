import { useState } from "react";
import { LANGUAGE_NAMES, nextLocale, useI18n } from "../i18n";
import { AppBar } from "../AppBar";
import {
  START_SCREENS,
  exportPreferences,
  getStartScreen,
  resetPreferences,
  setStartScreen,
  setStoredTheme,
  type StartScreen,
  type TextSize,
  type ThemePreference,
} from "../local-store";

/** Controls the App owns (it applies them to <html>), handed to Settings. */
export type PrefsControls = {
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
  reduceMotion: boolean;
  onReduceMotionChange: (value: boolean) => void;
  onPreferencesReset: () => void;
};

const THEME_OPTIONS: ThemePreference[] = ["dark", "light", "system"];
const TEXT_SIZES: TextSize[] = ["small", "medium", "large"];

/** Settings (Design Lock v1.0, QR-DESIGN-002). Only settings that genuinely
 * work are shown: language, start screen, theme, text size, reduced motion,
 * and local preference export/reset. Audio, notifications, sync, family and
 * account rows from the reference are intentionally absent: this app has no
 * audio, push, account or sync service, and a row that does nothing would
 * misrepresent that. Translations is read-only (Pickthall/Kazimirski are the
 * only certified sources bundled). */
export function SettingsScreen({
  onBack,
  theme,
  onThemeChange,
  prefs,
}: {
  onBack: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  prefs: PrefsControls;
}) {
  const { d, locale, setLocale } = useI18n();
  const [start, setStart] = useState<StartScreen>(() => getStartScreen());
  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const themeLabel: Record<ThemePreference, string> = {
    dark: d.prefs.themeMidnight,
    light: d.prefs.themeIvory,
    system: d.prefs.themeDevice,
  };
  const sizeLabel: Record<TextSize, string> = {
    small: d.settings.textSizeSmall,
    medium: d.settings.textSizeMedium,
    large: d.settings.textSizeLarge,
  };
  const startLabel: Record<StartScreen, string> = {
    home: d.prefs.startHome,
    quran: d.prefs.startQuran,
    continue: d.prefs.startContinue,
  };

  function exportNow() {
    const blob = new Blob([JSON.stringify(exportPreferences(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quranroots-preferences.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(d.prefs.exportDone);
  }

  function doReset() {
    resetPreferences();
    setStart(getStartScreen());
    setConfirmReset(false);
    prefs.onPreferencesReset();
    setStatus(d.prefs.resetDone);
  }

  return (
    <div data-testid="settings-screen">
      <AppBar title={d.settings.title} onBack={onBack} />

      <h2 className="group-label">{d.prefs.general}</h2>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <label className="setting-row" htmlFor="setting-start">
          <span className="setting-text">
            <span className="setting-title">{d.prefs.startScreen}</span>
            <span className="setting-hint">{d.prefs.startScreenHint}</span>
          </span>
          <select
            id="setting-start"
            className="setting-select"
            value={start}
            data-testid="setting-start-screen"
            onChange={(e) => {
              const next = e.target.value as StartScreen;
              setStartScreen(next);
              setStart(next);
            }}
          >
            {START_SCREENS.map((s) => (
              <option key={s} value={s}>
                {startLabel[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h2 className="group-label">{d.settings.language}</h2>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <button
          type="button"
          className="list-row"
          style={{ padding: 14 }}
          onClick={() => setLocale(nextLocale(locale))}
          data-testid="settings-language-row"
        >
          <span style={{ fontWeight: 600 }}>{d.settings.language}</span>
          <span className="text-muted">{LANGUAGE_NAMES[locale]}</span>
        </button>
        <div className="list-row" style={{ padding: 14, cursor: "default" }}>
          <span style={{ fontWeight: 600 }}>{d.settings.translations}</span>
          <span className="text-muted" dir="ltr" style={{ fontSize: "0.8rem", textAlign: "end" }}>
            English (Pickthall)
            <br />
            French (Kazimirski)
          </span>
        </div>
      </div>

      <h2 className="group-label">{d.settings.appearance}</h2>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <label className="setting-row" htmlFor="setting-theme">
          <span className="setting-text">
            <span className="setting-title">{d.settings.theme}</span>
            <span className="setting-hint">{d.prefs.appearanceHint}</span>
          </span>
          <select
            id="setting-theme"
            className="setting-select"
            value={theme}
            data-testid="setting-theme"
            onChange={(e) => {
              const next = e.target.value as ThemePreference;
              setStoredTheme(next);
              onThemeChange(next);
            }}
          >
            {THEME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {themeLabel[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="setting-row" htmlFor="setting-text-size">
          <span className="setting-text">
            <span className="setting-title">{d.settings.textSize}</span>
            <span className="setting-hint">{d.prefs.textSizeHint}</span>
          </span>
          <select
            id="setting-text-size"
            className="setting-select"
            value={prefs.textSize}
            data-testid="setting-text-size"
            onChange={(e) => prefs.onTextSizeChange(e.target.value as TextSize)}
          >
            {TEXT_SIZES.map((t) => (
              <option key={t} value={t}>
                {sizeLabel[t]}
              </option>
            ))}
          </select>
        </label>
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-title" id="reduce-motion-label">
              {d.prefs.reduceMotion}
            </span>
            <span className="setting-hint">{d.prefs.reduceMotionHint}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prefs.reduceMotion}
            aria-labelledby="reduce-motion-label"
            className={`switch${prefs.reduceMotion ? " on" : ""}`}
            data-testid="setting-reduce-motion"
            onClick={() => prefs.onReduceMotionChange(!prefs.reduceMotion)}
          >
            <span className="switch-knob" />
          </button>
        </div>
      </div>

      <h2 className="group-label">{d.prefs.yourData}</h2>
      <div className="card" style={{ padding: 0 }}>
        <button
          type="button"
          className="setting-row setting-button"
          onClick={exportNow}
          data-testid="setting-export"
        >
          <span className="setting-text">
            <span className="setting-title">{d.prefs.exportPrefs}</span>
            <span className="setting-hint">{d.prefs.exportPrefsHint}</span>
          </span>
        </button>
        <button
          type="button"
          className="setting-row setting-button"
          onClick={() => setConfirmReset(true)}
          data-testid="setting-reset"
        >
          <span className="setting-text">
            <span className="setting-title">{d.prefs.resetPrefs}</span>
            <span className="setting-hint">{d.prefs.resetPrefsHint}</span>
          </span>
        </button>
      </div>

      {status && (
        <p
          role="status"
          className="text-muted"
          style={{ margin: "12px 4px" }}
          data-testid="setting-status"
        >
          {status}
        </p>
      )}

      {confirmReset && (
        <div className="dialog-backdrop">
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-body"
            data-testid="reset-dialog"
          >
            <h3 id="reset-title">{d.prefs.resetTitle}</h3>
            <p id="reset-body" className="text-muted">
              {d.prefs.resetBody}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmReset(false)}
                data-testid="reset-cancel"
              >
                {d.prefs.cancel}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={doReset}
                data-testid="reset-confirm"
              >
                {d.prefs.resetConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
