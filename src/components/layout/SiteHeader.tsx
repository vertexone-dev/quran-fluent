import { Link } from "@tanstack/react-router";
import { BookOpen, CircleDot, Feather, Home, Layers, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { LanguageMenu } from "@/components/layout/LanguageMenu";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

// QR-INT-005: the signed-out primary nav mirrors the signed-in one (Design
// Lock v1: Home, Quran, Learn, Reflect, Memorize). Reflect and Memorize are
// still behind the existing _authenticated route guard -- a signed-out click
// lands on /auth, same as every other protected link.
// QR-INT-006 (owner decisions): the header carries only search, the globe
// language menu and the circular profile control. The theme control lives in
// Settings only; Log in / Create account and every secondary page (Features,
// Premium, About, Daily, Practice, Progress, Learning Plan, Bookmarks, Notes,
// Settings, Billing) are reached from the profile menu (ProfileMenu.tsx) and
// the footer. Below xl the five destinations are in MobileTabBar.
const NAV_ICONS: Record<"home" | "quran" | "learn" | "reflect" | "memorize", LucideIcon> = {
  home: Home,
  quran: BookOpen,
  learn: Layers,
  reflect: Feather,
  memorize: CircleDot,
};

const publicLinks = [
  { to: "/", key: "home" },
  { to: "/quran", key: "quran" },
  { to: "/learn", key: "learn" },
  { to: "/reflect", key: "reflect" },
  { to: "/memorize", key: "memorize" },
] as const;

// QR-INT-004: "home" for signed-in learners is the dashboard.
const authedLinks = [
  { to: "/dashboard", key: "home" },
  { to: "/quran", key: "quran" },
  { to: "/learn", key: "learn" },
  { to: "/reflect", key: "reflect" },
  { to: "/memorize", key: "memorize" },
] as const;

// "overlay" is the cinematic homepage's floating glass header, fixed over the
// hero image; every other route uses the sticky in-flow "default" variant.
type SiteHeaderVariant = "default" | "overlay";

function useScrolledPast(thresholdPx: number) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > thresholdPx);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [thresholdPx]);
  return scrolled;
}

export function SiteHeader({ variant = "default" }: { variant?: SiteHeaderVariant }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const scrolledPastHero = useScrolledPast(40);
  const links = user ? authedLinks : publicLinks;
  const isOverlay = variant === "overlay";

  // The bar is theme-independent (nav-glass in styles.css): every control sets
  // its own Ivory / Antique Gold colours. The wrapper ignores pointer events so
  // only the pill itself is clickable.
  return (
    <>
      <header
        className={
          isOverlay
            ? "animate-in fade-in slide-in-from-top-2 pointer-events-none fixed inset-x-0 top-0 z-40 px-2 pt-3 duration-700 sm:px-6 sm:pt-4"
            : "pointer-events-none sticky top-0 z-40 px-2 pt-3 sm:px-6 sm:pt-4"
        }
      >
        <div
          className={cn(
            isOverlay ? "nav-glass" : "nav-glass-dense",
            "pointer-events-auto mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-2 rounded-[26px] px-3 transition-shadow duration-500 sm:gap-4 sm:px-6",
            scrolledPastHero ? "shadow-elevated" : "shadow-none",
          )}
        >
          <Link
            to="/"
            className="min-w-0 shrink-0 xl:flex-1"
            aria-label={t("common.brand.homeAria")}
          >
            <Logo collapseWordmark tone="onDark" />
          </Link>

          <nav className="hidden items-center gap-1 xl:flex" aria-label={t("common.nav.main")}>
            {links.map((link) => {
              const Icon = NAV_ICONS[link.key];
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  activeOptions={{ exact: link.to === "/" }}
                  className="nav-pill-idle inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 text-[0.95rem] whitespace-nowrap transition-[color,box-shadow,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-[oklch(0.767_0.139_91.1)] min-[1440px]:gap-2.5 min-[1440px]:px-4 min-[1440px]:text-[1.02rem]"
                  activeProps={{ className: "nav-pill-active" }}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  {t(`common.nav.${link.key}`)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center justify-end gap-0.5 xl:flex-1 xl:gap-1 min-[1440px]:gap-1.5">
            <SearchDialog />
            <LanguageMenu />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <MobileTabBar />
    </>
  );
}
