import { Link } from "@tanstack/react-router";
import { ChevronRight, MountainSnow } from "lucide-react";

import { journeysArt } from "@/design/artwork";
import { GlassPanel, GOLD, SectionHeading } from "@/design/primitives";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

// QR-INT-006: homepage "Guided Learning Journeys". Levels and topics come
// from the existing course definition (d.learning.course, the same source as
// /learn). No progress is shown here: real per-learner progress lives on the
// dashboard and learning plan, so nothing is estimated or invented.
export function GuidedJourneysSection() {
  const { user } = useAuth();
  const { d } = useI18n();
  const j = d.home.journeys;
  const course = d.learning.course;
  const levels = course.levels.slice(0, 4);

  return (
    <section
      className="section-py-normal mx-auto max-w-6xl px-4"
      aria-labelledby="guided-journeys"
      data-testid="home-journeys-section"
    >
      <SectionHeading id="guided-journeys" eyebrow={j.eyebrow} title={j.title} body={j.body} />
      <GlassPanel className="mt-8 grid overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {journeysArt ? (
          <div className="relative min-h-[220px] lg:min-h-full">
            <img
              src={journeysArt}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.2_0.035_195.1/0.85)] via-transparent to-transparent lg:bg-gradient-to-r rtl:lg:bg-gradient-to-l" />
          </div>
        ) : null}
        <div className="p-5 sm:p-8">
          <ol className="space-y-3">
            {levels.map((level) => (
              <li
                key={level.level}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/15 p-4"
                data-testid="journey-level"
              >
                <MountainSnow
                  className="mt-0.5 size-6 shrink-0"
                  style={{ color: GOLD }}
                  strokeWidth={1.4}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: GOLD }}
                  >
                    {level.level}
                    {level.comingSoon ? (
                      <span className="ms-2 rounded-full border border-white/30 px-2 py-0.5 text-[11px] normal-case tracking-normal text-white/80">
                        {course.comingSoonLabel}
                      </span>
                    ) : null}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-white">
                    {level.title}
                  </h3>
                  <p className="mt-1 text-sm text-white/75">
                    {level.topics.slice(0, 3).join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            to={user ? "/learning-plan" : "/learn"}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border px-6 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/10"
            style={{ borderColor: GOLD }}
            data-testid="journeys-cta"
          >
            {user ? j.continueLearning : j.explore}
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
      </GlassPanel>
    </section>
  );
}
