import logoAsset from "@/assets/quranroots-logo.png.asset.json";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  tagline?: boolean;
};

export function Logo({ className, showWordmark = true, tagline = false }: LogoProps) {
  const { d } = useI18n();
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <img
        src={logoAsset.url}
        alt={d.common.brand.logoAlt}
        className="h-10 w-auto shrink-0"
        width={70}
        height={40}
      />
      {showWordmark && (
        <span className="flex min-w-0 flex-col leading-none">
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
