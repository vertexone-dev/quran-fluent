import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import { LanguageMenu } from "@/components/layout/LanguageMenu";
import { useI18n } from "@/lib/i18n";

// QR-INT-006: the Emergent cinematic footer -- a fixed Midnight Teal surface
// in both themes (like the nav bar), Ivory text, Antique Gold headings, the
// READ · UNDERSTAND · REFLECT · PRACTICE · GROW line and the same globe
// language menu as the header. Links and copy are unchanged.
const FOOTER_LINK =
  "flex min-h-11 items-center text-[oklch(0.974_0.01_87.5/0.78)] transition-colors hover:text-[oklch(0.88_0.1_91)]";
const FOOTER_HEADING = "font-display text-base font-semibold text-[oklch(0.88_0.1_91)]";

export function SiteFooter() {
  const { t, d } = useI18n();

  return (
    <footer
      className="section-py-compact mt-12 border-t border-[oklch(0.767_0.139_91.1/0.25)] bg-[oklch(0.2_0.035_195.1)] text-[oklch(0.974_0.01_87.5)]"
      data-testid="site-footer"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
          <div>
            <Logo tone="onDark" tagline />
            <p
              className="mt-3 text-xs uppercase tracking-[0.24em] text-[oklch(0.88_0.1_91)]"
              data-testid="footer-steps"
            >
              {d.home.hero.steps.join(" · ")}
            </p>
            <p className="mt-3 max-w-sm text-sm text-[oklch(0.974_0.01_87.5/0.78)]">
              {t("common.footer.intro")}
            </p>
          </div>
          <nav aria-label={t("common.footer.platform")} className="text-sm">
            <h2 className={FOOTER_HEADING}>{t("common.footer.platform")}</h2>
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
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-1">
              <li>
                <Link to="/learn" className={FOOTER_LINK}>
                  {t("common.footer.learnArabic")}
                </Link>
              </li>
              <li>
                <Link to="/quran" className={FOOTER_LINK}>
                  {t("common.footer.quranStudy")}
                </Link>
              </li>
              <li>
                <Link to="/features" className={FOOTER_LINK}>
                  {t("common.nav.features")}
                </Link>
              </li>
              <li>
                <Link to="/premium" className={FOOTER_LINK}>
                  {t("common.nav.premium")}
                </Link>
              </li>
              <li>
                <Link to="/about" className={FOOTER_LINK}>
                  {t("common.nav.about")}
                </Link>
              </li>
            </ul>
          </nav>
          <div className="text-sm">
            <h2 className={FOOTER_HEADING}>{t("common.footer.integrityTitle")}</h2>
            <p className="mt-3 text-[oklch(0.974_0.01_87.5/0.78)]">
              {t("common.footer.integrityBody")}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-xs text-[oklch(0.974_0.01_87.5/0.7)]">
            © {new Date().getFullYear()} {t("common.footer.rights")}
          </p>
          <LanguageMenu testIdPrefix="footer-language-menu" />
        </div>
      </div>
    </footer>
  );
}
