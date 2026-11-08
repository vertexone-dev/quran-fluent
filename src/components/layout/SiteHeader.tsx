import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CircleDot,
  Feather,
  Home,
  Laptop,
  Layers,
  Menu,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageMenu } from "@/components/layout/LanguageMenu";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SearchDialog } from "@/components/layout/SearchDialog";
import { ICON_BUTTON, MENU_ITEM, MENU_SURFACE } from "@/components/layout/navMenuStyles";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { isRtlLocale, useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

// QR-INT-005: the signed-out primary nav mirrors the signed-in one (Design
// Lock v1: Home, Quran, Learn, Reflect, Memorize). Reflect and Memorize are
// still behind the existing _authenticated route guard -- a signed-out click
// lands on /auth, same as every other protected link. Features, Premium and
// About moved to the drawer's secondary list and the footer; their routes
// are unchanged.
// QR-INT-005 (Emergent nav): every primary destination carries its reference
// icon -- Home, open book, layers, feather, ring.
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

const publicSecondaryLinks = [
  { to: "/features", key: "features" },
  { to: "/premium", key: "premium" },
  { to: "/about", key: "about" },
] as const;

// QR-INT-004: the five primary app destinations (Design Lock v1 nav).
// "home" reuses the same translation key the signed-out nav already uses
// for "/" -- the authenticated landing page (dashboard) now fills that
// same "Home" role instead of being labeled "Dashboard" in the primary
// nav, so no new copy is needed here.
const authedLinks = [
  { to: "/dashboard", key: "home" },
  { to: "/quran", key: "quran" },
  { to: "/learn", key: "learn" },
  { to: "/reflect", key: "reflect" },
  { to: "/memorize", key: "memorize" },
] as const;

// Everything that used to share top-level billing with the five primary
// destinations above, now grouped as secondary navigation (account menu on
// desktop, same list inside the drawer on mobile -- previously mobile only
// duplicated Settings/Billing here and had no drawer path at all to
// Learning Plan, Bookmarks or Notes).
const authedSecondaryLinks = [
  { to: "/daily", key: "daily" },
  { to: "/practice", key: "practice" },
  { to: "/progress", key: "progress" },
  { to: "/learning-plan", key: "learningPlan" },
  { to: "/bookmarks", key: "bookmarks" },
  { to: "/notes", key: "notes" },
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label={t("common.theme.change")}
          data-testid="theme-menu-trigger"
        >
          <Icon className="size-5" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className={MENU_SURFACE}>
        <DropdownMenuItem className={MENU_ITEM} onClick={() => setTheme("light")}>
          {t("common.theme.light")}
        </DropdownMenuItem>

        <DropdownMenuItem className={MENU_ITEM} onClick={() => setTheme("dark")}>
          {t("common.theme.dark")}
        </DropdownMenuItem>

        <DropdownMenuItem className={MENU_ITEM} onClick={() => setTheme("system")}>
          {t("common.theme.system")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// QR-INT-005: "overlay" is the cinematic homepage's floating glass header --
// fixed over the hero image instead of sitting in normal flow, transparent
// until the visitor scrolls past the hero. Opt-in and homepage-only (passed
// explicitly by src/routes/index.tsx): every other route keeps today's
// plain sticky/solid header untouched, so this never changes how the
// dashboard, Qur'an reader, settings, etc. look or behave.
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
  const { t, locale } = useI18n();
  // The trigger button sits at the row's trailing edge in both directions
  // (it's the last item in a flex row that the browser itself mirrors under
  // dir="rtl"), so the drawer should open from that same edge: the right in
  // ltr, the left in rtl (QR-INT-002).
  const mobileNavSide = isRtlLocale(locale) ? "left" : "right";

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const scrolledPastHero = useScrolledPast(40);

  const links = user ? authedLinks : publicLinks;

  async function signOut() {
    await queryClient.cancelQueries();

    queryClient.clear();

    await supabase.auth.signOut();

    navigate({
      to: "/auth",
      replace: true,
    });
  }

  const initials = (user?.email ?? "Q").slice(0, 1).toUpperCase();
  const isOverlay = variant === "overlay";

  // QR-INT-005 (Emergent nav): the bar is the reference's floating dark-teal
  // glass pill on EVERY route -- the overlay variant fixed over the cinematic
  // hero, the default variant sticky in flow -- and is theme-independent
  // (see nav-glass in styles.css), so every control inside it sets its own
  // Ivory / Antique Gold colors rather than inheriting theme tokens. The
  // wrapper ignores pointer events so only the pill itself is clickable.
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
            "pointer-events-auto mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-2 rounded-[26px] px-3 transition-shadow duration-500 sm:gap-4 sm:px-6 ",
            scrolledPastHero ? "shadow-elevated" : "shadow-none",
          )}
        >
          {/* Brand */}
          <Link
            to="/"
            className="min-w-0 shrink-0 xl:flex-1"
            aria-label={t("common.brand.homeAria")}
          >
            <Logo collapseWordmark tone="onDark" />
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 xl:flex" aria-label={t("common.nav.main")}>
            {links.map((link) => {
              const Icon = NAV_ICONS[link.key];
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  activeOptions={{
                    exact: link.to === "/",
                  }}
                  className="nav-pill-idle inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 text-[0.95rem] whitespace-nowrap transition-[color,box-shadow,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-[oklch(0.767_0.139_91.1)] min-[1440px]:gap-2.5 min-[1440px]:px-4 min-[1440px]:text-[1.02rem]"
                  activeProps={{ className: "nav-pill-active" }}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                  {t(`common.nav.${link.key}`)}
                </Link>
              );
            })}
          </nav>

          {/* Desktop controls */}
          <div className="hidden items-center xl:flex-1 xl:justify-end gap-1 xl:flex min-[1440px]:gap-1.5">
            <SearchDialog />

            <LanguageMenu />

            <ThemeToggle />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ms-1 inline-flex size-11 items-center justify-center rounded-full border border-[oklch(0.767_0.139_91.1/0.8)] bg-[oklch(0.25_0.04_190)] text-[oklch(0.974_0.01_87.5)] shadow-[0_0_14px_oklch(0.767_0.139_91.1/0.3)] transition-shadow hover:shadow-[0_0_20px_oklch(0.767_0.139_91.1/0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.767_0.139_91.1)]"
                    aria-label={t("common.nav.accountMenu")}
                    data-testid="account-menu-trigger"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-transparent text-[oklch(0.974_0.01_87.5)]">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className={cn("w-56", MENU_SURFACE)}
                  data-testid="account-menu-content"
                >
                  <DropdownMenuLabel className="truncate px-3 py-2">{user.email}</DropdownMenuLabel>

                  <DropdownMenuSeparator className="bg-[oklch(0.767_0.139_91.1/0.2)]" />

                  {authedSecondaryLinks.map((link) => (
                    <DropdownMenuItem key={link.to} asChild className={MENU_ITEM}>
                      <Link to={link.to}>{t(`common.nav.${link.key}`)}</Link>
                    </DropdownMenuItem>
                  ))}

                  <DropdownMenuItem asChild className={MENU_ITEM}>
                    <Link to="/settings">{t("common.nav.settings")}</Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild className={MENU_ITEM}>
                    <Link to="/settings/billing">{t("common.nav.billing")}</Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-[oklch(0.767_0.139_91.1/0.2)]" />

                  <DropdownMenuItem
                    className={MENU_ITEM}
                    onClick={signOut}
                    data-testid="logout-menu-item"
                  >
                    {t("common.actions.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button
                  variant="ghost"
                  asChild
                  className="text-[oklch(0.974_0.01_87.5/0.9)] hover:bg-white/5 hover:text-[oklch(0.88_0.1_91)]"
                >
                  <Link
                    to="/auth"
                    search={{
                      mode: "login",
                    }}
                  >
                    {t("common.actions.login")}
                  </Link>
                </Button>

                <Button asChild>
                  <Link
                    to="/auth"
                    search={{
                      mode: "signup",
                    }}
                  >
                    {t("common.actions.startLearning")}
                  </Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-0.5 xl:hidden">
            <SearchDialog />

            <LanguageMenu />

            <ThemeToggle />

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 text-[oklch(0.974_0.01_87.5/0.9)] hover:bg-white/5 hover:text-[oklch(0.88_0.1_91)]"
                  aria-label={t("common.nav.openMenu")}
                  data-testid="mobile-menu-trigger"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>

              <SheetContent side={mobileNavSide} className="w-[86vw] max-w-sm">
                <SheetTitle className="sr-only">{t("common.nav.navigation")}</SheetTitle>

                <div className="mt-2 flex flex-col gap-1">
                  {links.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors duration-300 hover:bg-accent"
                      activeProps={{ className: "bg-gold/15 ring-1 ring-gold/50" }}
                    >
                      {t(`common.nav.${link.key}`)}
                    </Link>
                  ))}

                  <div className="my-3 h-px bg-border" />

                  {user ? (
                    <>
                      {authedSecondaryLinks.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setOpen(false)}
                          className="rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {t(`common.nav.${link.key}`)}
                        </Link>
                      ))}

                      <Link
                        to="/settings"
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-3 py-3"
                      >
                        {t("common.nav.settings")}
                      </Link>

                      <Link
                        to="/settings/billing"
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-3 py-3"
                      >
                        {t("common.nav.billing")}
                      </Link>

                      <Button
                        variant="secondary"
                        className="mt-2"
                        data-testid="mobile-logout-button"
                        onClick={() => {
                          setOpen(false);
                          void signOut();
                        }}
                      >
                        {t("common.actions.logout")}
                      </Button>
                    </>
                  ) : (
                    <>
                      {publicSecondaryLinks.map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setOpen(false)}
                          className="rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {t(`common.nav.${link.key}`)}
                        </Link>
                      ))}

                      <Button variant="secondary" asChild className="mt-1">
                        <Link
                          to="/auth"
                          search={{
                            mode: "login",
                          }}
                          onClick={() => setOpen(false)}
                        >
                          {t("common.actions.login")}
                        </Link>
                      </Button>

                      <Button asChild className="mt-2">
                        <Link
                          to="/auth"
                          search={{
                            mode: "signup",
                          }}
                          onClick={() => setOpen(false)}
                        >
                          {t("common.actions.startLearning")}
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <MobileTabBar />
    </>
  );
}
