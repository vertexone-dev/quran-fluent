import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { CreditCard, Palette, ShieldCheck, SlidersHorizontal, User, BookOpen } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// QR-DESIGN-008B: the Settings section sidebar (Design Lock 05). It lists ONLY
// sections that exist on the settings pages today -- every in-page entry points
// at a real card on /settings, and Billing is the real /settings/billing route.
// Labels reuse the cards' own (already translated) titles. Nothing here is a
// control; it only navigates.

export const SETTINGS_SECTIONS = [
  { id: "profile", labelKey: "learning.settings.profile", Icon: User },
  { id: "learning-display", labelKey: "learning.settings.quranDisplay", Icon: BookOpen },
  { id: "appearance", labelKey: "learning.settings.appearance", Icon: Palette },
  {
    id: "display-preferences",
    labelKey: "learning.settings.preferencesTitle",
    Icon: SlidersHorizontal,
  },
  { id: "account", labelKey: "learning.settings.security", Icon: ShieldCheck },
] as const;

const ITEM =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const ITEM_IDLE = "text-foreground/85 hover:bg-accent hover:text-accent-foreground";
const ITEM_ACTIVE =
  "bg-[var(--gold)] text-[var(--gold-foreground)] shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]";

/**
 * Scroll-spy: the current section is the last one whose top edge has passed a
 * reading line a third of the way down the viewport (or the first section when
 * none has). Computed from real positions on scroll/resize, so tall cards and
 * short ones behave the same.
 */
function useActiveSection(enabled: boolean, initial: string) {
  const [active, setActive] = useState(initial);
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.33;
      let current: string = SETTINGS_SECTIONS[0].id;
      for (const { id } of SETTINGS_SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // At the very bottom the last section is current even if its top never reaches the line.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) current = SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1]!.id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return [active, setActive] as const;
}

export function SettingsNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const onGeneral = pathname.replace(/\/+$/, "") === "/settings";
  const onBilling = pathname.startsWith("/settings/billing");
  const initial = SETTINGS_SECTIONS.some((s) => s.id === hash) ? hash : SETTINGS_SECTIONS[0].id;
  const [active, setActive] = useActiveSection(onGeneral, initial);

  function go(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    if (!onGeneral) {
      void navigate({ to: "/settings", hash: id });
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // Keyboard and screen-reader users land on the section, not just near it.
    el.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  }

  return (
    <nav
      aria-label={t("learning.settings.navLabel")}
      data-testid="settings-nav"
      className="card-surface mb-6 rounded-2xl border bg-card p-2 lg:sticky lg:top-24 lg:mb-0 lg:self-start"
    >
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {SETTINGS_SECTIONS.map(({ id, labelKey, Icon }) => {
          const current = onGeneral && active === id;
          return (
            <li key={id} className="max-w-full lg:w-full">
              <a
                href={`/settings#${id}`}
                onClick={(e) => go(e, id)}
                aria-current={current ? "location" : undefined}
                data-testid={`settings-nav-${id}`}
                className={cn(ITEM, current ? ITEM_ACTIVE : ITEM_IDLE)}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{t(labelKey)}</span>
              </a>
            </li>
          );
        })}
        <li className="max-w-full lg:w-full">
          <Link
            to="/settings/billing"
            data-testid="settings-nav-billing"
            className={cn(ITEM, onBilling ? ITEM_ACTIVE : ITEM_IDLE)}
          >
            <CreditCard aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 break-words">{t("common.nav.billing")}</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
