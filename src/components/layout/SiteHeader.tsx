import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, Moon, Sun, Laptop } from "lucide-react";
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
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useAuth } from "@/lib/auth";
import { isRtlLocale, useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

const publicLinks = [
  { to: "/", key: "home" },
  { to: "/learn", key: "learn" },
  { to: "/quran", key: "quran" },
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
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label={t("common.theme.change")}
          data-testid="theme-menu-trigger"
        >
          <Icon className="size-5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          {t("common.theme.light")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setTheme("dark")}>
          {t("common.theme.dark")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setTheme("system")}>
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

  // Overlay's glass pill always uses the site's own theme background/border
  // tokens (same bg-background/backdrop-blur the default header already
  // uses) rather than a forced dark tint -- every existing child control
  // (ThemeToggle, LanguageSwitcher, account menu, login/signup buttons)
  // keeps its normal, already-verified theme-adaptive contrast with zero
  // extra overrides. Only the shape (floating rounded pill vs. full-width
  // bar) and the shadow (stronger once scrolled past the hero) change.
  return (
    <header
      className={
        isOverlay
          ? "animate-in fade-in slide-in-from-top-2 fixed inset-x-0 top-0 z-40 px-2 pt-3 duration-700 sm:px-6 sm:pt-4"
          : "sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur"
      }
    >
      <div
        className={
          isOverlay
            ? `mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[26px] border border-gold/20 bg-background/85 px-3 py-3 backdrop-blur-xl transition-shadow duration-500 sm:gap-4 sm:px-4 lg:flex lg:justify-between ${
                scrolledPastHero ? "shadow-elevated" : "shadow-none"
              }`
            : "mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:flex lg:justify-between"
        }
      >
        {/* Brand */}
        <Link to="/" className="min-w-0" aria-label={t("common.brand.homeAria")}>
          <Logo collapseWordmarkOnNarrow />
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label={t("common.nav.main")}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{
                exact: link.to === "/",
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-accent hover:text-accent-foreground"
              activeProps={{
                className:
                  "bg-gold/15 text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent),0_0_18px_color-mix(in_oklab,var(--gold)_35%,transparent)]",
              }}
            >
              {t(`common.nav.${link.key}`)}
            </Link>
          ))}
        </nav>

        {/* Desktop controls */}
        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />

          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 px-2"
                  aria-label={t("common.nav.accountMenu")}
                  data-testid="account-menu-trigger"
                >
                  <Avatar className="size-8">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56" data-testid="account-menu-content">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>

                <DropdownMenuSeparator />

                {authedSecondaryLinks.map((link) => (
                  <DropdownMenuItem key={link.to} asChild>
                    <Link to={link.to}>{t(`common.nav.${link.key}`)}</Link>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuItem asChild>
                  <Link to="/settings">{t("common.nav.settings")}</Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/settings/billing">{t("common.nav.billing")}</Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={signOut} data-testid="logout-menu-item">
                  {t("common.actions.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
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
        <div className="flex items-center gap-1 lg:hidden">
          <LanguageSwitcher />

          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11"
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
  );
}
