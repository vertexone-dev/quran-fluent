import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-24 border-t border-border bg-secondary/60">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
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
            {/* flex + min-h-11 gives each link a ~44px tap target -- the
                footer has room for it, unlike tighter inline controls
                elsewhere (see AyahCard.tsx's attribution button). This
                does make the footer modestly taller than before; that's
                the accessibility fix, not a side effect to hide. */}
            <ul className="mt-3 space-y-2 text-muted-foreground">
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
        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {t("common.footer.rights")}
        </p>
      </div>
    </footer>
  );
}
