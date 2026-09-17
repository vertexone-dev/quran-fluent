import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-16 border-t border-border bg-secondary/60">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
          <div>
            <Logo tagline />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              {t("common.footer.intro")}
            </p>
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("common.language.label")}
              </p>
              <LanguageSwitcher />
            </div>
          </div>
          <nav aria-label={t("common.footer.platform")} className="text-sm">
            <h2 className="font-display text-sm font-semibold text-foreground">
              {t("common.footer.platform")}
            </h2>
            {/* flex + min-h-11 gives each link a ~44px tap target -- kept
                exactly as-is (this is the accessibility fix, not a side
                effect to hide). What changes below md: is only the list's
                own shape: a 2-column grid instead of one full-width
                column, so four short labels ("Learn Arabic", "Qur'an
                study"...) take two ~44px rows instead of four -- half the
                stacked height this list added on mobile, where the footer
                was measured taking up most of a 390x844 screen. Reverts to
                the original single column at md: via grid-cols-1, once the
                outer grid above has room to run the three sections side by
                side instead of stacking them. */}
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-muted-foreground md:grid-cols-1">
              <li>
                <Link to="/learn" className="flex min-h-11 items-center hover:text-foreground">
                  {t("common.footer.learnArabic")}
                </Link>
              </li>
              <li>
                <Link to="/quran" className="flex min-h-11 items-center hover:text-foreground">
                  {t("common.footer.quranStudy")}
                </Link>
              </li>
              <li>
                <Link to="/features" className="flex min-h-11 items-center hover:text-foreground">
                  {t("common.nav.features")}
                </Link>
              </li>
              <li>
                <Link to="/about" className="flex min-h-11 items-center hover:text-foreground">
                  {t("common.nav.about")}
                </Link>
              </li>
            </ul>
          </nav>
          <div className="text-sm">
            <h2 className="font-display text-sm font-semibold text-foreground">
              {t("common.footer.integrityTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">{t("common.footer.integrityBody")}</p>
          </div>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {t("common.footer.rights")}
        </p>
      </div>
    </footer>
  );
}
