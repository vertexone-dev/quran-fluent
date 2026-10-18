import { useI18n } from "./i18n";

export function Logo({
  showWordmark = true,
  size = 40,
}: {
  showWordmark?: boolean;
  size?: number;
}) {
  const { d } = useI18n();
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <img
        src="/quranroots-logo.png"
        alt={d.brand.logoAlt}
        width={Math.round(size * 1.75)}
        height={size}
        style={{ height: size, width: "auto", flexShrink: 0 }}
      />
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "1.15rem",
            color: "var(--primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {d.brand.name}
        </span>
      )}
    </span>
  );
}
