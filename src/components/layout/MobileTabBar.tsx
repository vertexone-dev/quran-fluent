import { Link } from "@tanstack/react-router";
import { BookOpen, CircleDot, Feather, Home, Layers, type LucideIcon } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Tab = {
  to: string;
  key: "home" | "quran" | "learn" | "reflect" | "memorize";
  icon: LucideIcon;
};

// QR-INT-005: the Emergent floating bottom tab bar, below the desktop
// breakpoint. Emergent's reference tabs are Home / Quran / Learn / Progress /
// Settings, which would leave Reflect and Memorize (two of the five primary
// destinations) reachable only through the hamburger drawer. Here the five
// tabs are the app's five primary destinations themselves, so every one is a
// single tap away; Progress and Settings stay in the drawer / account menu.
const signedOutTabs: Tab[] = [
  { to: "/", key: "home", icon: Home },
  { to: "/quran", key: "quran", icon: BookOpen },
  { to: "/learn", key: "learn", icon: Layers },
  { to: "/reflect", key: "reflect", icon: Feather },
  { to: "/memorize", key: "memorize", icon: CircleDot },
];
const signedInTabs: Tab[] = signedOutTabs.map((tab) =>
  tab.key === "home" ? { ...tab, to: "/dashboard" } : tab,
);

export function MobileTabBar() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tabs = user ? signedInTabs : signedOutTabs;

  return (
    <nav
      aria-label={t("common.nav.main")}
      data-testid="mobile-tab-bar"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-[560px] xl:hidden"
    >
      <ul className="nav-glass-dense shadow-elevated flex items-stretch justify-around rounded-[24px] px-1 py-1.5">
        {tabs.map(({ to, key, icon: Icon }) => (
          <li key={key} className="min-w-0 flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              data-testid={`tab-${key}`}
              className="flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 text-[11px] font-semibold text-[oklch(0.974_0.01_87.5/0.8)] transition-colors hover:text-[oklch(0.88_0.1_91)] focus-visible:outline-2 focus-visible:outline-[oklch(0.767_0.139_91.1)] [&.is-active]:text-[oklch(0.767_0.139_91.1)]"
              activeProps={{ className: "is-active" }}
            >
              <Icon className="size-5" strokeWidth={1.5} aria-hidden />
              <span className="max-w-full truncate">{t(`common.nav.${key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
