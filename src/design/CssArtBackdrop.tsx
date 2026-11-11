import type { CSSProperties } from "react";

// QR-WEB-006: the production-safe replacement for the cinematic photo set.
// Drawn only with the approved Design Lock palette -- Midnight Teal, Antique
// Gold, Ivory -- using gradients and shapes: a lit arched window with a warm
// horizon glow, soft lantern light and a faint lattice. No image of any kind,
// nothing that can 404, nothing to license. Static (no animation), so it is
// already reduced-motion safe. It sits underneath the same scrims and text
// the photo version uses, so contrast is carried by the dark base, not by
// the decoration.

const TEAL = "#0B2F2F";
const GOLD = "#D4AF37";
const IVORY = "#F9F6EF";

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const fill: CSSProperties = { position: "absolute", inset: 0 };

/** Faint diagonal lattice, masked so it only shows toward the edges. */
const lattice: CSSProperties = {
  ...fill,
  opacity: 0.5,
  backgroundImage: `repeating-linear-gradient(45deg, ${rgba(GOLD, 0.07)} 0 1px, transparent 1px 22px), repeating-linear-gradient(-45deg, ${rgba(GOLD, 0.07)} 0 1px, transparent 1px 22px)`,
  maskImage: "radial-gradient(ellipse at 50% 55%, transparent 34%, #000 82%)",
  WebkitMaskImage: "radial-gradient(ellipse at 50% 55%, transparent 34%, #000 82%)",
};

type Variant = "hero" | "auth" | "journeys";

const ARCH: Record<Variant, { box: CSSProperties; glow: number }> = {
  hero: {
    box: { left: "50%", top: "9%", bottom: "-2%", width: "min(86vw, 880px)", translate: "-50% 0" },
    glow: 0.3,
  },
  auth: {
    box: { left: "50%", top: "6%", bottom: "-6%", width: "min(120vw, 960px)", translate: "-50% 0" },
    glow: 0.2,
  },
  journeys: {
    box: { left: "50%", top: "10%", bottom: "-4%", width: "min(78%, 420px)", translate: "-50% 0" },
    glow: 0.34,
  },
};

export function CssArtBackdrop({ variant }: { variant: Variant }) {
  const arch = ARCH[variant];
  return (
    <div
      aria-hidden="true"
      data-testid={`css-art-${variant}`}
      style={{
        ...fill,
        overflow: "hidden",
        backgroundImage: `linear-gradient(180deg, ${TEAL} 0%, #0a2a2a 55%, #061b1c 100%)`,
      }}
    >
      {/* soft lantern light, left and right */}
      <div
        style={{
          ...fill,
          backgroundImage: [
            `radial-gradient(circle at 9% 46%, ${rgba(GOLD, 0.26)}, transparent 22%)`,
            `radial-gradient(circle at 91% 40%, ${rgba(GOLD, 0.2)}, transparent 20%)`,
          ].join(","),
        }}
      />
      <div style={lattice} />
      {/* the lit arched window */}
      <div
        style={{
          position: "absolute",
          ...arch.box,
          borderRadius: "999px 999px 0 0",
          border: `1px solid ${rgba(GOLD, 0.34)}`,
          borderBottom: 0,
          backgroundImage: [
            // warm horizon glow at the foot of the arch
            `radial-gradient(ellipse 70% 42% at 50% 78%, ${rgba(GOLD, arch.glow)}, transparent 70%)`,
            // low sun
            `radial-gradient(circle at 50% 70%, ${rgba(IVORY, 0.16)}, transparent 9%)`,
            // sky: teal fading to a warm dusk
            `linear-gradient(180deg, ${rgba(TEAL, 0.2)} 0%, rgba(20, 78, 70, 0.5) 52%, ${rgba(GOLD, 0.1)} 100%)`,
          ].join(","),
          boxShadow: `inset 0 0 70px ${rgba(GOLD, 0.1)}, 0 0 90px ${rgba(GOLD, 0.07)}`,
        }}
      >
        {/* inner arch outline */}
        <div
          style={{
            position: "absolute",
            inset: "3.5% 4.5% 0",
            borderRadius: "999px 999px 0 0",
            border: `1px solid ${rgba(GOLD, 0.2)}`,
            borderBottom: 0,
          }}
        />
      </div>
      {/* a gold light line along the base of the scene */}
      <div
        style={{
          position: "absolute",
          left: "8%",
          right: "8%",
          bottom: "30%",
          height: 1,
          backgroundImage: `linear-gradient(90deg, transparent, ${rgba(GOLD, 0.45)}, transparent)`,
        }}
      />
    </div>
  );
}
