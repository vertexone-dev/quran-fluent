import { useI18n } from "./i18n";
import type { Tab } from "./navigation";

const ICONS: Record<Tab, string> = {
  home: "⌂",
  quran: "☰",
  lessons: "🎓",
  practice: "✎",
  more: "⋯",
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
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`tab-item${active === tab.key ? " active" : ""}`}
          onClick={() => onSelect(tab.key)}
          type="button"
        >
          <span className="tab-icon" aria-hidden="true">
            {ICONS[tab.key]}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
