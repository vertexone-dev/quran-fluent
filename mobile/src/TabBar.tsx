import { BookOpen, GraduationCap, Home, MoreHorizontal, PenLine, type LucideIcon } from "lucide-react";
import { useI18n } from "./i18n";
import type { Tab } from "./navigation";

const ICONS: Record<Tab, LucideIcon> = {
  home: Home,
  quran: BookOpen,
  lessons: GraduationCap,
  practice: PenLine,
  more: MoreHorizontal,
};

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { d } = useI18n();
  const tabs: { key: Tab; label: string }[] = [
    { key: "home", label: d.nav.home },
    { key: "quran", label: d.nav.quran },
    { key: "lessons", label: d.nav.lessons },
    { key: "practice", label: d.nav.practice },
    { key: "more", label: d.nav.more },
  ];
  return (
    <nav className="tab-bar">
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
          >
            <span className="tab-icon" aria-hidden="true">
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
