import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "./i18n";

export function AppBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { d } = useI18n();
  return (
    <div className="appbar">
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {onBack && (
          <button
            className="icon-btn"
            onClick={onBack}
            type="button"
            aria-label={d.common.back}
            data-testid="appbar-back"
          >
            <ChevronLeft size={22} className="dir-icon" />
          </button>
        )}
        <h1 className="appbar-title">{title}</h1>
      </div>
      {right}
    </div>
  );
}
