import { useI18n } from "./i18n";

/** Design Lock v1.0 logo -- the exact file the website's
 * src/components/brand/Logo.tsx renders (public/quranroots-logo.png). */
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
        width={Math.round((size * 240) / 216)}
        height={size}
        style={{ height: size, width: "auto", flexShrink: 0, borderRadius: 8 }}
        data-testid="brand-logo"
      />
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.35rem",
            color: "var(--gold)",
            letterSpacing: "0.01em",
          }}
        >
          {d.brand.name}
        </span>
      )}
    </span>
  );
}
