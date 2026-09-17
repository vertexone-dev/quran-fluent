import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="section-py-compact mt-12 border-t border-border bg-secondary/60">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
          <div>
            <Logo tagline />
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {t("common.footer.intro")}
            </p>
            {/* Hidden below md: -- moved to the bottom bar there instead
                (see below). On a side-by-side grid, a column's height only
                matters up to whichever column is tallest; this brand
                column already isn't the tallest at md:+ once its own
                stacked mobile height stops applying, so keeping the
                switcher here at md:+ costs nothing, while moving it out on
                mobile (where height is a straight sum of every block, not
                a max) is the actual win. */}
            <div className="mt-5 hidden md:block">
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
        {/* Below md:, copyright and a second LanguageSwitcher instance
            share one bordered bar -- the brand column's own copy above
            stops at the intro paragraph there, so this is where the
            switcher moves to instead, removing an entire label+control
            block from mobile's stacked column height (the biggest single
            reduction in this footer's mobile height). At md:+ this
            collapses back to a plain copyright line with no border,
            because the switcher is already shown above and a second,
            visible copy of the same control would be redundant, not an
            improvement. The two instances are never visible at the same
            time -- Tailwind's `hidden` is display:none, which removes an
            element from the accessibility tree entirely, not just from
            view, so this is exactly one focusable/announced switcher at
            any given width, the same as before this change. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 md:mt-6 md:border-0 md:pt-0">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t("common.footer.rights")}
          </p>
          <div className="md:hidden">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
