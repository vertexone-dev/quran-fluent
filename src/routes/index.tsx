import { createFileRoute, Link } from "@tanstack/react-router";
import { type MouseEvent as ReactMouseEvent, type ReactNode, useRef, useState } from "react";
import { motion, MotionConfig, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  BookOpen,
  BookOpenText,
  ChevronRight,
  Headphones,
  Brain,
  Feather,
  GraduationCap,
  LineChart,
  Languages,
  Compass,
} from "lucide-react";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { isRtlLocale, useI18n } from "@/lib/i18n";
import { useDocumentTitle } from "@/lib/use-document-title";

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
// Design Lock v1.0 reference (GoldButton), reimplemented as a real
// router Link (not a plain button) so navigation, middle-click/open-in-new-
// tab and screen readers all behave like every other link on the site.
// Both call sites on this page point to the same signup route, so it's
// hardcoded here rather than threaded through as generic, loosely-typed
// `to`/`search` props that would need to bypass TanStack Router's own
// compile-time route checking.
function CinematicCtaLink({ children, testId }: { children: ReactNode; testId: string }) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

  const onClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const size = Math.max(r.width, r.height) / 2;
    const id = Date.now();
    setRipples((p) => [
      ...p,
      { id, x: e.clientX - r.left - size / 2, y: e.clientY - r.top - size / 2, size },
    ]);
    window.setTimeout(() => setRipples((p) => p.filter((x) => x.id !== id)), 700);
  };

  return (
    <Link
      to="/auth"
      search={{ mode: "signup" }}
      onClick={onClick}
      data-testid={testId}
      className="group bg-primary text-primary-foreground relative isolate inline-flex h-[60px] items-center justify-center gap-3 overflow-hidden rounded-full px-9 text-lg font-semibold shadow-[0_0_0_1px_color-mix(in_oklab,var(--gold)_55%,transparent),0_0_26px_color-mix(in_oklab,var(--gold)_45%,transparent)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--gold)_75%,transparent),0_0_36px_color-mix(in_oklab,var(--gold)_60%,transparent)] active:scale-[0.97] sm:h-[70px] sm:px-11"
    >
      <span className="cta-ring" aria-hidden="true" />
      <span className="relative z-10 inline-flex items-center gap-3">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="hero-ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
    </Link>
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
  { icon: BookOpenText, to: "/quran" as const },
  { icon: GraduationCap, to: "/learn" as const },
  { icon: Feather, to: "/reflect" as const },
  { icon: BookOpen, to: "/memorize" as const },
];

function CinematicHero({
  home,
  dir,
}: {
  home: ReturnType<typeof useI18n>["d"]["home"];
  dir: "ltr" | "rtl";
}) {
  const { t } = useI18n();
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
          <picture>
            <source media="(max-width: 767px)" srcSet="/quranroots-hero-cinematic-mobile.jpg" />
            <img
              src="/quranroots-hero-cinematic-desktop.jpg"
              alt=""
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-[50%_42%] md:object-[50%_58%]"
            />
          </picture>
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
          style={{ color: HERO_GOLD }}
          className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] font-semibold tracking-[0.3em] uppercase sm:text-xs"
        >
          {home.hero.badge}
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
          <CinematicCtaLink testId="hero-continue-reading-button">
            <BookOpen className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            {t("common.actions.startLearning")}
            <ChevronRight
              className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              aria-hidden
            />
          </CinematicCtaLink>
          <Link
            to="/quran"
            className="inline-flex h-[60px] items-center justify-center rounded-full border border-white/40 px-9 text-lg font-semibold text-white transition-colors duration-300 hover:border-gold hover:bg-white/10 sm:h-[70px] sm:px-11"
          >
            {t("common.actions.exploreQuran")}
          </Link>
        </motion.div>
        <motion.p {...fadeUp(1.25, reduce)} className="mt-6 max-w-md text-sm text-white/70">
          {home.hero.note}
        </motion.p>
      </div>
      <div className="pb-6 pt-16 sm:pt-20" aria-hidden="true" />
    </section>
  );
}

function QuickLinkCard({
  item,
  icon: Icon,
  to,
  index,
  reduce,
}: {
  item: { title: string; body: string };
  icon: typeof BookOpen;
  to: (typeof quickLinkMeta)[number]["to"];
  index: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: reduce ? 0 : 0.7, ease: EASE_OUT, delay: reduce ? 0 : index * 0.08 }}
      className="h-full"
    >
      <Link to={to} className="group block h-full rounded-2xl">
        <Card className="shadow-soft hover:shadow-elevated border-border/70 bg-card/90 hover:border-gold/60 h-full backdrop-blur transition-all duration-300 group-hover:-translate-y-1">
          <CardContent className="pt-6">
            <span className="bg-gold/15 text-gold inline-flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:-translate-y-0.5">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold sm:text-lg">{item.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{item.body}</p>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function Home() {
  const { t, d, locale } = useI18n();
  const home = d.home;
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";
  const reduce = useReducedMotion() ?? false;
  useDocumentTitle(home.hero.documentTitle);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col">
        <SiteHeader variant="overlay" />

        <main>
          <CinematicHero home={home} dir={dir} />

          <section
            className="relative mx-auto -mt-10 max-w-6xl px-4 sm:-mt-14"
            aria-labelledby="quick-links"
          >
            <h2 id="quick-links" className="sr-only">
              {home.quickLinks.title}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {home.quickLinks.items.map((item, index) => {
                const meta = quickLinkMeta[index];
                if (!meta) return null;
                return (
                  <QuickLinkCard
                    key={item.title}
                    item={item}
                    icon={meta.icon}
                    to={meta.to}
                    index={index}
                    reduce={reduce}
                  />
                );
              })}
            </div>
          </section>

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
                <CinematicCtaLink testId="footer-cta-start-learning-button">
                  {t("common.actions.startLearning")}
                </CinematicCtaLink>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
