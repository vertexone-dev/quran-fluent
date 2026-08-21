import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, Moon, Sun, Laptop } from "lucide-react";
import { useState } from "react";

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
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

const publicLinks = [
  { to: "/", key: "home" },
  { to: "/learn", key: "learn" },
  { to: "/quran", key: "quran" },
  { to: "/features", key: "features" },
  { to: "/about", key: "about" },
] as const;

const authedLinks = [
  { to: "/dashboard", key: "dashboard" },
  { to: "/daily", key: "daily" },
  { to: "/learn", key: "learn" },
  { to: "/quran", key: "quran" },
  { to: "/memorize", key: "memorize" },
  { to: "/practice", key: "practice" },
  { to: "/progress", key: "progress" },
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

export function SiteHeader() {
  const { user } = useAuth();
  const { t } = useI18n();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:flex lg:justify-between">
        {/* Brand */}
        <Link to="/" className="min-w-0" aria-label={t("common.brand.homeAria")}>
          <Logo />
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
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              activeProps={{
                className: "bg-accent text-accent-foreground",
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

                <DropdownMenuItem asChild>
                  <Link to="/dashboard">{t("common.nav.dashboard")}</Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/learning-plan">{t("common.nav.learningPlan")}</Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/bookmarks">{t("common.nav.bookmarks")}</Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/notes">{t("common.nav.notes")}</Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link to="/settings">{t("common.nav.settings")}</Link>
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

            <SheetContent side="right" className="w-[86vw] max-w-sm">
              <SheetTitle className="sr-only">{t("common.nav.navigation")}</SheetTitle>

              <div className="mt-2 flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-accent"
                  >
                    {t(`common.nav.${link.key}`)}
                  </Link>
                ))}

                <div className="my-3 h-px bg-border" />

                {user ? (
                  <>
                    <Link
                      to="/settings"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-3 py-3"
                    >
                      {t("common.nav.settings")}
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
