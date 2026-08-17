import { createFileRoute } from "@tanstack/react-router";

import { RoadmapPage } from "@/components/common/RoadmapPage";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({
    meta: [
      { title: "Practice centre — QuranRoots" },
      { name: "description", content: "Vocabulary, reading, listening, grammar and root recognition drills." },
      { property: "og:title", content: "Practice centre — QuranRoots" },
      { property: "og:description", content: "Targeted practice with difficulty levels and tracked results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Practice,
});

function Practice() {
  const { d } = useI18n();
  const p = d.learning.practice;
  return (
    <RoadmapPage title={p.title} phase={p.phase} intro={p.intro} planned={p.planned} note={p.note} />
  );
}
