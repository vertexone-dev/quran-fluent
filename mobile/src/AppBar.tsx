import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useI18n } from "./i18n";

export function AppBar({
  title,
  onBack,
  right,
  subtitle,
  centered = false,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Optional second line under the title (centered layout only). */
  subtitle?: ReactNode;
  /** Design Lock header: back at the start, title centred, balanced end slot. */
  centered?: boolean;
}) {
  const { d } = useI18n();
  if (centered) {
    return (
      <div className="appbar appbar-centered">
        <div className="appbar-side">
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
        </div>
        <div className="appbar-center">
          <h1 className="appbar-title">{title}</h1>
          {subtitle}
        </div>
        <div className="appbar-side appbar-side-end">{right}</div>
      </div>
    );
  }
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
