import { BookOpen, Brain, GraduationCap, Home, Sparkles, type LucideIcon } from "lucide-react";
import { useI18n } from "./i18n";
import { PLANNED_TABS, type Tab } from "./navigation";

const ICONS: Record<Tab, LucideIcon> = {
  home: Home,
  quran: BookOpen,
  learn: GraduationCap,
  reflect: Sparkles,
  memorize: Brain,
};

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { d } = useI18n();
  const tabs: { key: Tab; label: string }[] = [
    { key: "home", label: d.nav.home },
    { key: "quran", label: d.nav.quran },
    { key: "learn", label: d.nav.learn },
    { key: "reflect", label: d.nav.reflect },
    { key: "memorize", label: d.nav.memorize },
  ];
  return (
    <nav className="tab-bar" aria-label={d.nav.primary} data-testid="tab-bar">
      {tabs.map((tab) => {
        const Icon = ICONS[tab.key];
        const isActive = active === tab.key;
        const planned = PLANNED_TABS.has(tab.key);
        return (
          <button
            key={tab.key}
            className={`tab-item${isActive ? " active" : ""}`}
            onClick={() => onSelect(tab.key)}
            type="button"
            aria-current={isActive ? "page" : undefined}
            aria-label={planned ? `${tab.label} (${d.planned.badge})` : undefined}
            data-testid={`tab-${tab.key}`}
          >
            <span className="tab-icon" aria-hidden="true">
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
            </span>
            {planned && <span className="tab-planned-dot" aria-hidden="true" />}
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
