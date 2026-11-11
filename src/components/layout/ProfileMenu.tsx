import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, LogIn, LogOut, Settings, UserPlus, UserRound } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MENU_ITEM, MENU_SURFACE } from "@/components/layout/navMenuStyles";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

// QR-INT-006 (Emergent nav), owner-approved menu contents:
//   signed out: Log In, Create Account, Settings (the existing sign-in guard
//               sends visitors to /auth first)
//   signed in:  My Profile (Settings' profile card), My Progress, Settings,
//               Sign Out
// Study pages stay reachable from the dashboard; Billing from Settings;
// Features / About / Premium from the footer.

const SEPARATOR = "bg-[oklch(0.767_0.139_91.1/0.2)]";
const TRIGGER =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[oklch(0.767_0.139_91.1/0.8)] bg-[oklch(0.25_0.04_190)] text-[oklch(0.974_0.01_87.5)] shadow-[0_0_14px_oklch(0.767_0.139_91.1/0.3)] transition-shadow duration-300 hover:shadow-[0_0_20px_oklch(0.767_0.139_91.1/0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[oklch(0.767_0.139_91.1)]";

export function ProfileMenu() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (user?.email ?? "").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(TRIGGER, "ms-1")}
          aria-label={t("common.nav.accountMenu")}
          data-testid={user ? "account-menu-trigger" : "profile-menu-trigger"}
        >
          {user ? (
            <span className="font-display text-lg font-semibold" aria-hidden>
              {initials}
            </span>
          ) : (
            <UserRound className="size-5" strokeWidth={1.5} aria-hidden />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className={cn("w-60", MENU_SURFACE)}
        data-testid={user ? "account-menu-content" : "profile-menu-content"}
      >
        {user ? (
          <>
            <DropdownMenuLabel className="truncate px-3 py-2">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator className={SEPARATOR} />
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link to="/settings" hash="profile" data-testid="profile-menu-my-profile">
                <UserRound className="size-4" aria-hidden />
                {t("common.nav.myProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link to="/progress" data-testid="profile-menu-my-progress">
                <BarChart3 className="size-4" aria-hidden />
                {t("common.nav.myProgress")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link to="/settings" data-testid="profile-menu-settings">
                <Settings className="size-4" aria-hidden />
                {t("common.nav.settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className={SEPARATOR} />
            <DropdownMenuItem
              className={MENU_ITEM}
              onClick={signOut}
              data-testid="logout-menu-item"
            >
              <LogOut className="size-4" aria-hidden />
              {t("common.actions.logout")}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link to="/auth" search={{ mode: "login" }} data-testid="profile-menu-login">
                <LogIn className="size-4" aria-hidden />
                {t("common.actions.login")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link to="/auth" search={{ mode: "signup" }} data-testid="profile-menu-signup">
                <UserPlus className="size-4" aria-hidden />
                {t("common.actions.createAccount")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className={SEPARATOR} />
            <DropdownMenuItem asChild className={MENU_ITEM}>
              <Link
                to="/auth"
                search={{ mode: "login", redirect: "/settings" }}
                data-testid="profile-menu-settings"
              >
                <Settings className="size-4" aria-hidden />
                {t("common.nav.settings")}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
