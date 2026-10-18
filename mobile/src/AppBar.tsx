import type { ReactNode } from "react";
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {onBack && (
          <button className="back-button" onClick={onBack} type="button" aria-label={d.common.back}>
            ←
          </button>
        )}
        <h1 className="appbar-title">{title}</h1>
      </div>
      {right}
    </div>
  );
}
