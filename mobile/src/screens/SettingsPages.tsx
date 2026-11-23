import { useState } from "react";
import { Check, ChevronRight, Info } from "lucide-react";
import { LANGUAGE_NAMES, useI18n, type Locale } from "../i18n";
import { AppBar } from "../AppBar";
import type { Route, SettingsPage } from "../navigation";
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
import type { PrefsControls } from "./SettingsScreen";

const THEME_OPTIONS: ThemePreference[] = ["dark", "light", "system"];
const TEXT_SIZES: TextSize[] = ["small", "medium", "large"];
const LOCALES: Locale[] = ["en", "fr", "ar"];

/** Settings sub-pages. Every control here already existed on the single
 * Settings page; they are only regrouped to follow the Design Lock reference's
 * categories. Behaviour, storage keys and test ids are unchanged. */
export function SettingsPageScreen({
  page,
  onBack,
  onNavigate,
  theme,
  onThemeChange,
  prefs,
}: {
  page: SettingsPage;
  onBack: () => void;
  onNavigate: (route: Route) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  prefs: PrefsControls;
}) {
  const { d } = useI18n();
  const n = d.settingsNav;
  const title = {
    general: n.general,
    reading: n.reading,
    language: n.language,
    appearance: n.appearance,
    privacy: n.privacy,
  }[page];
  return (
    <div data-testid={`settings-page-${page}`}>
      <AppBar centered title={title} onBack={onBack} />
      {page === "general" && <GeneralPage />}
      {page === "reading" && <ReadingPage onNavigate={onNavigate} />}
      {page === "language" && <LanguagePage />}
      {page === "appearance" && (
        <AppearancePage theme={theme} onThemeChange={onThemeChange} prefs={prefs} />
      )}
      {page === "privacy" && <PrivacyPage prefs={prefs} />}
    </div>
  );
}

function GeneralPage() {
  const { d } = useI18n();
  const [start, setStart] = useState<StartScreen>(() => getStartScreen());
  const startLabel: Record<StartScreen, string> = {
    home: d.prefs.startHome,
    quran: d.prefs.startQuran,
    continue: d.prefs.startContinue,
  };
  return (
    <div className="card" style={{ padding: 0 }}>
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
  );
}

function ReadingPage({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { d } = useI18n();
  return (
    <>
      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
        <div className="setting-row" data-testid="settings-translations">
          <span className="setting-text">
            <span className="setting-title">{d.settings.translations}</span>
          </span>
          <span className="text-muted" dir="ltr" style={{ fontSize: "0.8rem", textAlign: "end" }}>
            English (Pickthall)
            <br />
            French (Kazimirski)
          </span>
        </div>
        <button
          type="button"
          className="setting-row setting-button"
          onClick={() => onNavigate({ screen: "about" })}
          data-testid="settings-reading-sources"
        >
          <span className="setting-text">
            <span className="setting-title">{d.settingsNav.sourcesLink}</span>
          </span>
          <ChevronRight size={18} className="text-muted dir-icon" aria-hidden="true" />
        </button>
      </div>
      <p className="setting-hint" style={{ margin: "0 4px", lineHeight: 1.6 }}>
        <Info size={14} aria-hidden="true" style={{ verticalAlign: "-2px", marginInlineEnd: 6 }} />
        {d.settingsNav.readingNote}
      </p>
    </>
  );
}

function LanguagePage() {
  const { d, locale, setLocale } = useI18n();
  return (
    <>
      <h2 className="group-label">{d.settingsNav.languageGroup}</h2>
      <div
        className="card"
        style={{ padding: 0 }}
        role="radiogroup"
        aria-label={d.settingsNav.languageGroup}
        data-testid="language-options"
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={locale === l}
            className="setting-row setting-button"
            lang={l}
            onClick={() => setLocale(l)}
            data-testid={`language-option-${l}`}
          >
            <span className="setting-text">
              <span className="setting-title">{LANGUAGE_NAMES[l]}</span>
            </span>
            {locale === l && <Check size={18} className="settings-nav-icon" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </>
  );
}

function AppearancePage({
  theme,
  onThemeChange,
  prefs,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  prefs: PrefsControls;
}) {
  const { d } = useI18n();
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
  return (
    <div className="card" style={{ padding: 0 }}>
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
  );
}

function PrivacyPage({ prefs }: { prefs: PrefsControls }) {
  const { d } = useI18n();
  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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
    setConfirmReset(false);
    prefs.onPreferencesReset();
    setStatus(d.prefs.resetDone);
  }

  return (
    <>
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
    </>
  );
}
