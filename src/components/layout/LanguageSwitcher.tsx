import { LOCALE_LABELS, SUPPORTED_LOCALES, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** FR | EN switch. Available to guests and signed-in learners alike. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card p-0.5",
        className,
      )}
      role="group"
      aria-label={t("common.language.change")}
    >
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          lang={code}
          title={LOCALE_LABELS[code].label}
          className={cn(
            "min-h-9 rounded-full px-3 text-xs font-semibold uppercase tracking-wide transition-colors",
            locale === code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LOCALE_LABELS[code].short}
          <span className="sr-only"> — {LOCALE_LABELS[code].label}</span>
        </button>
      ))}
    </div>
  );
}
