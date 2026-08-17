import { createFileRoute } from "@tanstack/react-router";

import { RoadmapPage } from "@/components/common/RoadmapPage";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes — QuranRoots" },
      { name: "description", content: "Your private study notes on Ayat, words and lessons." },
      { property: "og:title", content: "Notes — QuranRoots" },
      { property: "og:description", content: "Private notes attached to what you are studying." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Notes,
});

function Notes() {
  const { d } = useI18n();
  const n = d.memorization.notes;
  return (
    <RoadmapPage title={n.title} phase={n.phase} intro={n.intro} planned={n.planned} note={n.note} />
  );
}
