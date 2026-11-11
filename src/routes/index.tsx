import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { type MouseEvent as ReactMouseEvent, type ReactNode, useRef, useState } from "react";
import { motion, MotionConfig, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  BookOpen,
  BookOpenText,
  ChevronRight,
  Headphones,
  Layers,
  Brain,
  Feather,
  GraduationCap,
  LineChart,
  Languages,
  Compass,
  Play,
  Sprout,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { UnderstandAyahSection } from "@/components/home/UnderstandAyahSection";
import { GuidedJourneysSection } from "@/components/home/GuidedJourneysSection";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { fetchBookmarks } from "@/lib/bookmarks";
import { fetchSurahs, surahName } from "@/lib/quran";
import { isRtlLocale, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/use-document-title";
import { heroArt } from "@/design/artwork";
import { CssArtBackdrop } from "@/design/CssArtBackdrop";

// QR-INT-005: shared easing/duration for the hero's entrance choreography,
// reused across every staggered element below so they read as one
// composition rather than independently-timed pieces.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
// The hero sits on the same night/sunset photo regardless of the site's
// Ivory/Midnight Teal theme toggle (see surface-hero-cinematic in
// styles.css), so its decorative gold accents are fixed to the approved
// "Antique Gold" value (the .dark theme's own --gold, already WCAG-verified
// at 6.83:1 against Midnight Teal) rather than the theme-variable --gold,
// which goes too muted/dark-for-light-backgrounds to read against the
// image's bright sky region when the rest of the site is in Ivory mode.
const HERO_GOLD = "oklch(0.767 0.139 91.1)";
const fadeUp = (delay: number, reduce: boolean) => ({
  initial: reduce ? false : { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: reduce ? 0 : 0.8, ease: EASE_OUT, delay: reduce ? 0 : delay },
});

function HeroArch({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 52" className={className} fill="none" aria-hidden="true">
      <path
        d="M8 52V36C8 22 40 20 60 2C80 20 112 22 112 36V52"
        stroke="url(#hero-arch-gradient)"
        strokeWidth="1.4"
      />
      <defs>
        <linearGradient id="hero-arch-gradient" x1="0" y1="0" x2="0" y2="52">
          <stop offset="0" style={{ stopColor: HERO_GOLD }} stopOpacity="0.9" />
          <stop offset="1" style={{ stopColor: HERO_GOLD }} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HeroDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`} aria-hidden="true">
      <span
        className="h-px w-16 sm:w-24"
        style={{ backgroundImage: `linear-gradient(to right, transparent, ${HERO_GOLD})` }}
      />
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ stroke: HERO_GOLD }}>
        <path d="M9 1l8 8-8 8-8-8z" strokeWidth="1.2" />
      </svg>
      <span
        className="h-px w-16 sm:w-24"
        style={{ backgroundImage: `linear-gradient(to left, transparent, ${HERO_GOLD})` }}
      />
    </div>
  );
}

// Masked line-by-line title reveal -- each line rises out of a clipped mask
// rather than simply fading in. Skips the transform entirely under reduced
// motion (the line is just rendered in place, no animation at all) rather
// than relying on this repo's global CSS duration-zeroing rule, since
// framer-motion drives this via JS transforms the CSS rule can't reach.
function HeroTitle({ lines, reduce, delay }: { lines: string[]; reduce: boolean; delay: number }) {
  return (
    <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[4rem]">
      {lines.map((line, i) => (
        <span key={line} className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
          <motion.span
            className="block [text-shadow:0_4px_30px_rgba(0,0,0,0.55)]"
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: "0%" }}
            transition={{
              duration: reduce ? 0 : 1,
              ease: EASE_OUT,
              delay: reduce ? 0 : delay + i * 0.14,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

// Gold glow CTA with a click ripple -- adapted from the approved Emergent
// Design Lock v1.0 reference (GoldButton). Split into a hook + shared
// className + content wrapper (rather than one wrapper component) so each
// call site renders its own real, concretely-typed router <Link> -- the two
// CTAs on this page go to different destinations, and threading `to`/
// `search` through a generic wrapper would mean bypassing TanStack Router's
// compile-time route checking.
type Ripple = { id: number; x: number; y: number; size: number };

function useCtaRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const onClick = (e: ReactMouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const size = Math.max(r.width, r.height) / 2;
    const id = Date.now();
    setRipples((p) => [
      ...p,
      { id, x: e.clientX - r.left - size / 2, y: e.clientY - r.top - size / 2, size },
    ]);
    window.setTimeout(() => setRipples((p) => p.filter((x) => x.id !== id)), 700);
  };
  return { ripples, onClick };
}

const CTA_CLASSNAME =
  "group bg-primary text-primary-foreground relative isolate inline-flex h-[60px] items-center justify-center gap-3 overflow-hidden rounded-full px-9 text-lg font-semibold shadow-[0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent),0_0_26px_color-mix(in_oklab,var(--gold)_45%,transparent)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--gold)_75%,transparent),0_0_36px_color-mix(in_oklab,var(--gold)_60%,transparent)] active:scale-[0.97] sm:h-[70px] sm:px-11";

// QR-WEB-009: the hero's "Continue Reading" button, matching the approved
// Design Lock v1.0 reference: a dark glass pill with a refined Antique Gold
// outline and soft gold glow (the rotating gold ring from CtaGlowContent
// stays as the outline). The hero is always dark, so the gold is pinned to
// the literal Antique Gold rather than the theme's --gold. Contrast: ivory
// text on a near-black teal fill. The footer CTA keeps CTA_CLASSNAME.
const HERO_CTA_CLASSNAME =
  "group relative isolate inline-flex h-[60px] items-center justify-center gap-3 overflow-hidden rounded-full bg-[oklch(0.19_0.04_192/0.62)] px-9 text-lg font-semibold text-[#F9F6EF] backdrop-blur-md [--gold:oklch(0.767_0.139_91.1)] shadow-[inset_0_0_18px_color-mix(in_oklab,var(--gold)_14%,transparent),0_0_0_1px_color-mix(in_oklab,var(--gold)_45%,transparent),0_0_28px_color-mix(in_oklab,var(--gold)_32%,transparent)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[oklch(0.24_0.05_192/0.74)] hover:shadow-[inset_0_0_22px_color-mix(in_oklab,var(--gold)_22%,transparent),0_0_0_1px_color-mix(in_oklab,var(--gold)_75%,transparent),0_0_40px_color-mix(in_oklab,var(--gold)_48%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.767_0.139_91.1)] focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.16_0.035_190)] active:scale-[0.97] sm:h-[70px] sm:px-11";

function CtaGlowContent({ ripples, children }: { ripples: Ripple[]; children: ReactNode }) {
  return (
    <>
      <span className="cta-ring" aria-hidden="true" />
      <span className="relative z-10 inline-flex items-center gap-3">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="hero-ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuranRoots — Learn Arabic. Understand the Qur'an." },
      {
        name: "description",
        content:
          "A premium academy for Qur'anic Arabic in English and French: read, understand word by word, memorize and track real progress.",
      },
      { property: "og:title", content: "QuranRoots — Learn Arabic. Understand the Qur'an." },
      {
        property: "og:description",
        content: "Build your Qur'anic Arabic skills one word, one verse, and one lesson at a time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const pillarIcons = [GraduationCap, BookOpenText, Brain, Languages, Headphones, LineChart];

// QR-INT-004: the five primary app destinations, minus "Home" (we're
// already on it) -- same order and targets as the authenticated nav's
// authedLinks in SiteHeader.tsx. Reflect/Memorize are behind auth; a
// signed-out click lands on /auth, same as every other authenticated link
// this page already offers (e.g. the hero's "Start Learning" CTA).
const quickLinkMeta = [
  { icon: BookOpenText, to: "/quran" as const, search: {} },
  // "Understand This Ayah": the reader's real Vocabulary study tab (word
  // meaning, root and type from verified data) -- URL-addressable via ?tab=.
  { icon: Layers, to: "/quran" as const, search: { tab: "vocabulary" as const } },
  { icon: Feather, to: "/reflect" as const, search: {} },
  { icon: BookOpen, to: "/memorize" as const, search: {} },
  { icon: GraduationCap, to: "/learn" as const, search: {} },
];

function CinematicHero({
  home,
  dir,
}: {
  home: ReturnType<typeof useI18n>["d"]["home"];
  dir: "ltr" | "rtl";
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { ripples, onClick: onCtaClick } = useCtaRipple();

  // "Continue Reading" resumes at the learner's most recent bookmark -- the
  // only genuine saved reading position this app stores (there is no
  // separate last-read tracker). Signed-out visitors and learners with no
  // bookmarks get the plain reader (/quran) instead: an honest fallback,
  // never signup and never an invented position or percentage. Queries are
  // gated so anonymous visitors trigger no extra requests.
  const { data: bookmarks } = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => fetchBookmarks(user!.id),
    enabled: Boolean(user?.id),
  });
  const resumeAt = bookmarks?.[0] ?? null;
  const { data: surahs } = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
    enabled: resumeAt !== null,
  });
  const resumeSurah = resumeAt ? surahs?.find((s) => s.number === resumeAt.surah_number) : null;
  const resumeSearch = resumeAt ? { surah: resumeAt.surah_number, ayah: resumeAt.ayah_number } : {};

  const heroRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 110]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.07]);
  const arrow = dir === "rtl" ? "←" : "→";

  return (
    <section
      ref={heroRef}
      data-testid="hero-section"
      className="surface-hero-cinematic hero-grain relative isolate flex min-h-[100svh] flex-col overflow-hidden pt-28 sm:pt-32 md:min-h-[820px]"
    >
      {/* Full-bleed night/sunset backdrop (Design Lock v1.0 approved
          reference, AI-generated art -- see this PR's description for the
          licensing caveat). aria-hidden + alt="": purely atmospheric, the
          heading/subtitle/CTA below carry the hero's actual content.
          surface-hero-cinematic (a fixed dark gradient, not a theme
          variable) is the base layer underneath this <picture>, so a
          failed image request still leaves light text on a dark,
          intentional-looking background instead of a blank/white gap --
          same guarantee tests/e2e/52-production-polish.spec.ts already
          checks for, now against this image instead of the old boxed
          daytime photo. */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <motion.div style={{ y, scale }} className="absolute inset-0 origin-top">
          {heroArt ? (
            <picture>
              <source media="(max-width: 767px)" srcSet={heroArt.mobile} />
              <img
                src={heroArt.desktop}
                alt=""
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover object-[50%_42%] md:object-[50%_58%]"
              />
            </picture>
          ) : (
            // Production default (QR-WEB-006): CSS-only, no image.
            <CssArtBackdrop variant="hero" />
          )}
        </motion.div>
        <div className="from-background/90 absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent" />
        <div className="from-background/95 via-background/50 absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t to-transparent md:h-[32%]" />
      </div>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center px-5 pt-4 text-center">
        <motion.div {...fadeUp(0.2, reduce)}>
          <HeroArch className="mb-1 h-8 w-24 sm:h-10 sm:w-28" />
        </motion.div>
        <motion.p
          {...fadeUp(0.3, reduce)}
          data-testid="hero-steps"
          style={{ color: HERO_GOLD }}
          className="-my-1 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-2xl bg-[oklch(0.15_0.035_190/0.42)] px-4 py-1 text-[11px] font-semibold tracking-[0.3em] uppercase sm:text-xs rtl:text-sm rtl:tracking-normal [text-shadow:0_0_2px_oklch(0.1_0.03_190/1),0_1px_3px_oklch(0.1_0.03_190/0.95),0_0_8px_oklch(0.12_0.03_190/0.85),0_0_18px_oklch(0.12_0.03_190/0.6)]"
        >
          {home.hero.steps.map((step, i) => (
            <span key={step} className="inline-flex items-center gap-2.5">
              {step}
              {i < home.hero.steps.length - 1 && (
                <span aria-hidden="true" className="text-white/70">
                  {arrow}
                </span>
              )}
            </span>
          ))}
        </motion.p>
        <motion.div {...fadeUp(0.4, reduce)}>
          <HeroDivider className="my-4" />
        </motion.div>
        <HeroTitle
          lines={[home.hero.titleLine1, home.hero.titleLine2]}
          reduce={reduce}
          delay={0.5}
        />
        <motion.p
          {...fadeUp(0.95, reduce)}
          className="mt-4 max-w-xl text-base text-white/90 md:text-lg"
        >
          {home.hero.subtitle}
        </motion.p>
        <motion.div
          {...fadeUp(1.1, reduce)}
          className="mt-7 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:gap-4"
        >
          <Link
            to="/quran"
            search={resumeSearch}
            onClick={onCtaClick}
            data-testid="hero-continue-reading-button"
            className={HERO_CTA_CLASSNAME}
          >
            <CtaGlowContent ripples={ripples}>
              <BookOpen className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              {home.hero.continueReading}
              <ChevronRight
                className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                aria-hidden
              />
            </CtaGlowContent>
          </Link>
        </motion.div>
        <motion.p
          {...fadeUp(1.25, reduce)}
          className="-mb-1.5 mt-[1.125rem] max-w-md rounded-2xl bg-[oklch(0.15_0.035_190/0.62)] px-4 py-1.5 text-sm text-white/90 backdrop-blur-[3px] [text-shadow:0_1px_2px_oklch(0.12_0.03_190/0.95),0_0_8px_oklch(0.12_0.03_190/0.85),0_0_18px_oklch(0.12_0.03_190/0.6)]"
        >
          {home.hero.note}
        </motion.p>
      </div>

      <div className="mx-auto mt-12 w-full max-w-[1200px] px-4 pb-8 sm:px-6 md:mt-16">
        <section aria-labelledby="quick-links">
          <h2 id="quick-links" className="sr-only">
            {home.quickLinks.title}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5 lg:gap-4 xl:gap-5">
            {home.quickLinks.items.map((item, index) => {
              const meta = quickLinkMeta[index];
              if (!meta) return null;
              return (
                // An odd fifth card centers on its own row in the two-column
                // layouts instead of leaving a hole beside it.
                <div
                  key={item.title}
                  className={
                    index === 4
                      ? "col-span-2 mx-auto w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:col-span-1 lg:w-auto"
                      : undefined
                  }
                >
                  <QuickLinkCard
                    item={item}
                    icon={meta.icon}
                    to={meta.to}
                    search={meta.search}
                    index={index}
                    reduce={reduce}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <JourneyPanel
          home={home}
          signedIn={Boolean(user)}
          reduce={reduce}
          resume={
            resumeAt
              ? {
                  label: t("home.hero.continuingFrom", {
                    surah: resumeSurah
                      ? surahName(resumeSurah, locale)
                      : String(resumeAt.surah_number),
                    ayah: String(resumeAt.ayah_number),
                  }),
                }
              : null
          }
          resumeSearch={resumeSearch}
        />
      </div>
    </section>
  );
}

// Fixed dark-glass surfaces: these cards sit on the hero's night photo in
// both site themes, so (like the hero's text) they don't follow the theme
// toggle.
const GLASS =
  "bg-[linear-gradient(180deg,oklch(0.324_0.046_195.1/0.72),oklch(0.2_0.035_195.1/0.82))] backdrop-blur-xl";

function QuickLinkCard({
  item,
  icon: Icon,
  to,
  search,
  index,
  reduce,
}: {
  item: { title: string; body: string };
  icon: typeof BookOpen;
  to: (typeof quickLinkMeta)[number]["to"];
  search: (typeof quickLinkMeta)[number]["search"];
  index: number;
  reduce: boolean;
}) {
  // The first card is the reference's highlighted "primary" card.
  const active = index === 0;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? 0 : 0.9,
        ease: EASE_OUT,
        delay: reduce ? 0 : 1.3 + index * 0.09,
      }}
      className="h-full"
    >
      <Link to={to} search={search} className="group block h-full rounded-[22px]">
        <div
          className={`${GLASS} flex h-full flex-col items-center rounded-[22px] border px-3 pb-5 pt-5 text-center transition-[transform,box-shadow,border-color] duration-500 group-hover:-translate-y-1 sm:px-4 sm:pt-6 ${
            active
              ? "border-[oklch(0.767_0.139_91.1/0.9)] shadow-[0_0_0_1px_oklch(0.767_0.139_91.1/0.35),0_0_36px_oklch(0.767_0.139_91.1/0.28)]"
              : "border-[oklch(0.767_0.139_91.1/0.22)] group-hover:border-[oklch(0.767_0.139_91.1/0.7)] group-hover:shadow-[0_0_32px_oklch(0.767_0.139_91.1/0.22)]"
          }`}
        >
          <span
            style={{ color: HERO_GOLD }}
            className="mb-3 transition-transform duration-500 group-hover:-translate-y-1 sm:mb-4"
          >
            <Icon className="size-8 sm:size-10" strokeWidth={1.3} aria-hidden />
          </span>
          <h3 className="font-display text-base font-semibold text-white sm:text-lg">
            {item.title}
          </h3>
          <p className="mt-1.5 max-w-[15rem] text-xs leading-snug text-white/75 sm:text-sm">
            {item.body}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

// The reference's "Your Journey" bar -- minus its invented "42%": a real
// saved position when the learner has one, otherwise an honest empty state
// that says what to do to get one. No percentages or progress bars are ever
// shown here; real progress lives on the dashboard.
function JourneyPanel({
  home,
  signedIn,
  reduce,
  resume,
  resumeSearch,
}: {
  home: ReturnType<typeof useI18n>["d"]["home"];
  signedIn: boolean;
  reduce: boolean;
  resume: { label: string } | null;
  resumeSearch: { surah?: number; ayah?: number };
}) {
  const j = home.journey;
  const ctaClass =
    "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10";
  const ctaStyle = { borderColor: HERO_GOLD };
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.9, ease: EASE_OUT, delay: reduce ? 0 : 1.7 }}
      data-testid="hero-journey"
      className={`${GLASS} mt-5 flex flex-col items-center gap-4 rounded-[26px] border border-[oklch(0.767_0.139_91.1/0.22)] px-5 py-4 text-center sm:flex-row sm:text-start md:px-8`}
    >
      <div className="flex items-center gap-3 sm:border-e sm:border-white/15 sm:pe-6">
        <Sprout
          className="size-7 shrink-0"
          style={{ color: HERO_GOLD }}
          strokeWidth={1.4}
          aria-hidden
        />
        <h2 className="font-display text-lg font-semibold text-white">{j.title}</h2>
      </div>
      {resume ? (
        <>
          <p
            data-testid="hero-resume-position"
            className="flex-1 text-sm font-medium text-white/90 sm:text-base"
          >
            {resume.label}
          </p>
          <Link to="/quran" search={resumeSearch} className={ctaClass} style={ctaStyle}>
            <Play className="size-4" aria-hidden />
            {j.resumeCta}
          </Link>
        </>
      ) : signedIn ? (
        <>
          <p className="flex-1 text-sm text-white/80 sm:text-base">{j.emptySignedIn}</p>
          <Link to="/quran" className={ctaClass} style={ctaStyle}>
            {j.openReader}
          </Link>
        </>
      ) : (
        <>
          <p className="flex-1 text-sm text-white/80 sm:text-base">{j.emptySignedOut}</p>
          <Link to="/auth" search={{ mode: "signup" }} className={ctaClass} style={ctaStyle}>
            {j.createAccount}
          </Link>
        </>
      )}
    </motion.div>
  );
}

function Home() {
  const { t, d, locale } = useI18n();
  const home = d.home;
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const reduce = useReducedMotion() ?? false;
  const { ripples: footerRipples, onClick: onFooterCtaClick } = useCtaRipple();
  useDocumentTitle(home.hero.documentTitle);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col">
        <SiteHeader variant="overlay" />

        <main>
          <CinematicHero home={home} dir={dir} />

          <UnderstandAyahSection />

          <GuidedJourneysSection />

          <section
            className="section-py-normal mx-auto max-w-6xl px-4"
            aria-labelledby="how-it-works"
          >
            <h2 id="how-it-works" className="font-display text-2xl font-bold sm:text-3xl">
              {home.how.title}
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {home.how.steps.map((step, index) => (
                <li key={step.title}>
                  <Card className="shadow-soft hover:shadow-elevated h-full border-t-2 border-t-gold/60 transition-all duration-300 hover:-translate-y-1">
                    <CardContent className="pt-6">
                      <span className="font-display text-sm font-bold text-gold">0{index + 1}</span>
                      <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </section>

          <section className="section-py-normal bg-secondary/60" aria-labelledby="pillars">
            <div className="mx-auto max-w-6xl px-4">
              <h2 id="pillars" className="font-display text-2xl font-bold sm:text-3xl">
                {home.pillars.title}
              </h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {home.pillars.items.map((pillar, index) => {
                  const Icon = pillarIcons[index] ?? GraduationCap;
                  return (
                    <Card
                      key={pillar.title}
                      className="shadow-soft hover:shadow-elevated h-full border-border/70 transition-all duration-300 hover:-translate-y-1 hover:border-gold/60"
                    >
                      <CardContent className="pt-6">
                        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <h3 className="mt-4 font-display text-lg font-semibold">{pillar.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{pillar.body}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            className="section-py-normal mx-auto max-w-6xl px-4"
            aria-labelledby="word-study"
          >
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div>
                <h2 id="word-study" className="font-display text-2xl font-bold sm:text-3xl">
                  {home.wordStudy.title}
                </h2>
                <p className="mt-4 text-muted-foreground">{home.wordStudy.body}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {home.wordStudy.bullets.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Compass className="size-4 text-gold" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <Card className="shadow-elevated border-gold/40">
                <CardContent className="p-6">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {home.wordStudy.panelLabel}
                  </p>
                  {/* text-left overrides dir="rtl"'s own default right-alignment
                    -- dir/lang stay for correct Arabic glyph shaping and
                    joining, but the word itself lines up under the panel
                    label above it instead of floating to the opposite edge
                    of the card. */}
                  <p
                    className="font-arabic mt-3 text-left text-4xl leading-snug text-foreground"
                    lang="ar"
                    dir="rtl"
                  >
                    الحمد
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{home.wordStudy.meaning}</dt>
                      <dd className="mt-1 font-medium">{home.wordStudy.meaningValue}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{home.wordStudy.transliteration}</dt>
                      <dd className="mt-1 font-medium">al-ḥamdu</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{home.wordStudy.root}</dt>
                      {/* Same text-left override as the headline word above,
                        for the same reason: this value must start at the
                        same left edge as every other value in this grid,
                        not float to the right because it's RTL script. */}
                      <dd
                        className="font-arabic mt-1 text-left text-lg leading-snug"
                        lang="ar"
                        dir="rtl"
                      >
                        ح م د
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{home.wordStudy.wordType}</dt>
                      <dd className="mt-1 font-medium">{home.wordStudy.wordTypeValue}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Testimonials section intentionally hidden (Production Polish,
            Stage 4A): the home page was shipping a visible placeholder --
            "Placeholder — real learner stories will be added before
            launch." -- as public-facing content. Hidden entirely rather
            than replaced with invented reviews/names/ratings/quotations;
            home.testimonials stays in the locale files (English + French)
            for when real, approved testimonials exist to restore this
            section with. */}

          <section className="section-py-normal mx-auto max-w-4xl px-4">
            <div className="border-gold/30 bg-secondary/60 rounded-3xl border px-6 py-12 text-center sm:px-12">
              <h2 className="font-display text-3xl font-bold">{home.cta.title}</h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{home.cta.body}</p>
              <div className="mt-8 flex justify-center">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  onClick={onFooterCtaClick}
                  data-testid="footer-cta-start-learning-button"
                  className={CTA_CLASSNAME}
                >
                  <CtaGlowContent ripples={footerRipples}>
                    {t("common.actions.startLearning")}
                  </CtaGlowContent>
                </Link>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
