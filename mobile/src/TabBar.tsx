import {
  BookOpen,
  ChartColumn,
  GraduationCap,
  Home,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "./i18n";
import type { Tab } from "./navigation";

const ICONS: Record<Tab, LucideIcon> = {
  home: Home,
  quran: BookOpen,
  learn: GraduationCap,
  progress: ChartColumn,
  settings: Settings,
};

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { d } = useI18n();
  const tabs: { key: Tab; label: string }[] = [
    { key: "home", label: d.nav.home },
    { key: "quran", label: d.nav.quran },
    { key: "learn", label: d.nav.learn },
    { key: "progress", label: d.tabs.progress },
    { key: "settings", label: d.tabs.settings },
  ];
  return (
    <nav className="tab-bar" aria-label={d.nav.primary} data-testid="tab-bar">
      {tabs.map((tab) => {
        const Icon = ICONS[tab.key];
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            className={`tab-item${isActive ? " active" : ""}`}
            onClick={() => onSelect(tab.key)}
            type="button"
            aria-current={isActive ? "page" : undefined}
            data-testid={`tab-${tab.key}`}
          >
            <span className="tab-icon" aria-hidden="true">
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
