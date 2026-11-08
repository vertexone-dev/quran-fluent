import logoAsset from "@/assets/quranroots-logo.png.asset.json";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  tagline?: boolean;
  /** Visually hides the wordmark (still read by screen readers) where the
   * header's other controls leave no room for it -- very narrow phones, and
   * mid-width laptops where the full-width nav is showing alongside the
   * language switcher and sign-in buttons (French labels are the widest).
   * Otherwise it's clipped or overlapped mid-word. */
  collapseWordmark?: boolean;
};

export function Logo({
  className,
  showWordmark = true,
  tagline = false,
  collapseWordmark = false,
}: LogoProps) {
  const { d } = useI18n();
  return (
    <span className={cn("flex items-center gap-3", className)}>
      {/* QR-UI-002A: logo asset is now a cropped badge from the Design Lock
          v1.0 official logo (arch/mosque/book emblem, wordmark text
          excluded -- the wordmark below is still live text, not baked into
          the image). It carries its own Midnight Teal background rather
          than being transparent, so it's rendered as a rounded badge
          instead of a borderless mark -- that reads as intentional in both
          themes instead of showing a stray rectangle in the light theme.
          width/height match the asset's real 240x216 intrinsic ratio
          (previously 70x40 didn't match the old asset's ratio either; it's
          just a layout-reservation hint, h-10 w-auto still controls the
          rendered size). */}
      <img
        src={logoAsset.url}
        alt={d.common.brand.logoAlt}
        className="h-10 w-auto shrink-0 rounded-lg"
        width={44}
        height={40}
      />
      {showWordmark && (
        <span
          className={cn(
            "flex min-w-0 flex-col leading-none",
            collapseWordmark && "max-[409px]:sr-only min-[1024px]:max-[1279px]:sr-only",
          )}
        >
          <span className="font-display text-xl font-bold tracking-tight text-primary">
            {d.common.brand.name}
          </span>
          {tagline && (
            <span className="mt-1 text-[0.68rem] text-muted-foreground">
              {d.common.brand.tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
