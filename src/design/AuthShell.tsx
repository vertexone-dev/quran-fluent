import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { heroArt } from "@/design/artwork";
import { CssArtBackdrop } from "@/design/CssArtBackdrop";
import { useI18n } from "@/lib/i18n";

/** Card classes for forms placed inside AuthShell (theme-aware card, cinematic edge). */
export const AUTH_CARD =
  "w-full max-w-md rounded-[26px] border-[oklch(0.767_0.139_91.1/0.35)] bg-card/95 shadow-[0_24px_60px_-24px_oklch(0.12_0.03_190/0.8)] backdrop-blur-xl";

/**
 * QR-INT-006: cinematic frame for Log in, Create account, Forgot and Reset
 * password. Presentation only -- every form, Supabase call and redirect stays
 * in the route that renders it.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div
      className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[oklch(0.2_0.035_195.1)] px-4 py-12"
      data-testid="auth-shell"
    >
      {heroArt ? (
        <picture aria-hidden="true">
          <source media="(max-width: 767px)" srcSet={heroArt.mobile} />
          <img
            src={heroArt.desktop}
            alt=""
            decoding="async"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_45%]"
          />
        </picture>
      ) : (
        <div className="absolute inset-0 -z-20" aria-hidden="true">
          <CssArtBackdrop variant="auth" />
        </div>
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,oklch(0.2_0.035_195.1/0.55),oklch(0.2_0.035_195.1/0.85))]"
      />
      <Link to="/" className="mb-8 rounded-full" aria-label={t("common.brand.homeAria")}>
        <Logo tone="onDark" />
      </Link>
      {children}
    </div>
  );
}
