import { createFileRoute } from "@tanstack/react-router";

import { RoadmapPage } from "@/components/common/RoadmapPage";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/memorize")({
  head: () => ({
    meta: [
      { title: "Memorize (Hifz) — QuranRoots" },
      { name: "description", content: "Listen, repeat, hide and recite with structured Hifz tools." },
      { property: "og:title", content: "Memorize (Hifz) — QuranRoots" },
      { property: "og:description", content: "A dedicated memorization workflow with review scheduling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Memorize,
});

function Memorize() {
  const { d } = useI18n();
  const m = d.memorization;
  return (
    <RoadmapPage title={m.title} phase={m.phase} intro={m.intro} planned={m.planned} note={m.note} />
  );
}
