import type { CSSProperties } from "react";

// QR-WEB-006 / QR-WEB-009: the production-safe replacement for the cinematic
// photo set. Drawn only with the approved Design Lock palette -- Midnight
// Teal, Antique Gold, Ivory -- using gradients and shapes: a lit arched window
// with a warm horizon glow, a low sun with faint rays, soft lantern light, a
// darker ground plane and a faint lattice. No image of any kind, nothing that
// can 404, nothing to license. Static (no animation), so it is already
// reduced-motion safe. It sits underneath the same scrims and text the photo
// version uses, so contrast is carried by the dark base, not by the
// decoration; the warm light is concentrated at the horizon, low in the
// frame, away from the headline.

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

type Config = {
  /** Where the arched window sits inside the panel. */
  box: CSSProperties;
  /** Strength of the warm horizon glow inside the arch (0-1). */
  glow: number;
  /** Horizon (sun) height as a % of the arch's own height. */
  horizon: number;
  /** Warm bloom across the whole panel behind the arch (0-1). */
  bloom: number;
  rays: boolean;
  path: boolean;
};

const CONFIG: Record<Variant, Config> = {
  hero: {
    box: { left: "50%", top: "9%", bottom: "-2%", width: "min(86vw, 880px)", translate: "-50% 0" },
    glow: 0.42,
    horizon: 76,
    bloom: 0.2,
    rays: true,
    path: false,
  },
  auth: {
    box: { left: "50%", top: "6%", bottom: "-6%", width: "min(120vw, 960px)", translate: "-50% 0" },
    glow: 0.26,
    horizon: 76,
    bloom: 0.12,
    rays: false,
    path: false,
  },
  // Narrower and taller than the hero's arch so it reads on a short, wide
  // mobile panel, with a path of light leading the eye to the horizon.
  journeys: {
    box: { left: "50%", top: "7%", bottom: "-2%", width: "min(52%, 300px)", translate: "-50% 0" },
    glow: 0.46,
    horizon: 66,
    bloom: 0.24,
    rays: true,
    path: true,
  },
};

export function CssArtBackdrop({ variant }: { variant: Variant }) {
  const c = CONFIG[variant];
  const sun = `50% ${c.horizon}%`;
  return (
    <div
      aria-hidden="true"
      data-testid={`css-art-${variant}`}
      style={{
        ...fill,
        overflow: "hidden",
        backgroundImage: `linear-gradient(180deg, ${TEAL} 0%, #0a2a2a 52%, #061b1c 100%)`,
      }}
    >
      {/* warm bloom: the glow of the horizon spilling across the whole scene */}
      <div
        style={{
          ...fill,
          backgroundImage: `radial-gradient(ellipse 90% 40% at 50% ${c.horizon + 4}%, ${rgba(GOLD, c.bloom)}, transparent 72%)`,
        }}
      />
      {/* soft lantern light, left and right */}
      <div
        style={{
          ...fill,
          backgroundImage: [
            `radial-gradient(circle at 9% 46%, ${rgba(GOLD, 0.28)}, transparent 22%)`,
            `radial-gradient(circle at 91% 40%, ${rgba(GOLD, 0.22)}, transparent 20%)`,
          ].join(","),
        }}
      />
      <div style={lattice} />
      {/* depth: the room falls away into shadow at the edges */}
      <div
        style={{
          ...fill,
          backgroundImage: `radial-gradient(ellipse 75% 70% at 50% 48%, transparent 48%, rgba(3, 16, 17, 0.55) 100%)`,
        }}
      />
      {/* halo: a faint outer arch behind the window */}
      <div
        style={{
          position: "absolute",
          ...c.box,
          top: `calc(${c.box.top} - 2.4%)`,
          width: `calc(${c.box.width} + 6%)`,
          borderRadius: "999px 999px 0 0",
          border: `1px solid ${rgba(GOLD, 0.1)}`,
          borderBottom: 0,
        }}
      />
      {/* the lit arched window */}
      <div
        style={{
          position: "absolute",
          ...c.box,
          overflow: "hidden",
          borderRadius: "999px 999px 0 0",
          border: `1px solid ${rgba(GOLD, 0.36)}`,
          borderBottom: 0,
          backgroundImage: [
            // warm horizon glow at the foot of the arch
            `radial-gradient(ellipse 72% 44% at ${sun}, ${rgba(GOLD, c.glow)}, transparent 72%)`,
            // low sun
            `radial-gradient(circle at ${sun}, ${rgba(IVORY, 0.2)}, transparent 8%)`,
            // sky: teal fading to a warm dusk
            `linear-gradient(180deg, ${rgba(TEAL, 0.2)} 0%, rgba(20, 78, 70, 0.5) 50%, ${rgba(GOLD, 0.14)} 100%)`,
          ].join(","),
          boxShadow: `inset 0 0 70px ${rgba(GOLD, 0.12)}, 0 0 100px ${rgba(GOLD, 0.08)}`,
        }}
      >
        {c.rays ? (
          // faint rays fanning up from the sun, fading well before the text
          <div
            style={{
              ...fill,
              backgroundImage: `repeating-conic-gradient(from 270deg at ${sun}, ${rgba(GOLD, 0.075)} 0deg 4deg, transparent 4deg 13deg)`,
              maskImage: `radial-gradient(circle at ${sun}, #000, transparent 62%)`,
              WebkitMaskImage: `radial-gradient(circle at ${sun}, #000, transparent 62%)`,
            }}
          />
        ) : null}
        {/* ground: the horizon plane falls back into the night */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${c.horizon}%`,
            bottom: 0,
            backgroundImage: `linear-gradient(180deg, ${rgba(GOLD, 0.1)} 0%, rgba(6, 27, 28, 0.72) 38%, rgba(6, 27, 28, 0.92) 100%)`,
          }}
        />
        {c.path ? (
          // a path of light leading from the foot of the arch to the horizon
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${c.horizon}%`,
              bottom: 0,
              clipPath: "polygon(47% 0, 53% 0, 82% 100%, 18% 100%)",
              backgroundImage: `linear-gradient(180deg, ${rgba(GOLD, 0.5)} 0%, ${rgba(GOLD, 0.16)} 70%, transparent 100%)`,
            }}
          />
        ) : null}
        {/* inner arch outline */}
        <div
          style={{
            position: "absolute",
            inset: "3.5% 4.5% 0",
            borderRadius: "999px 999px 0 0",
            border: `1px solid ${rgba(GOLD, 0.22)}`,
            borderBottom: 0,
          }}
        />
        {/* a gold light line along the horizon */}
        <div
          style={{
            position: "absolute",
            left: "6%",
            right: "6%",
            top: `${c.horizon}%`,
            height: 1,
            backgroundImage: `linear-gradient(90deg, transparent, ${rgba(GOLD, 0.55)}, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
