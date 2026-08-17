import { createFileRoute } from "@tanstack/react-router";

import { RoadmapPage } from "@/components/common/RoadmapPage";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks — QuranRoots" },
      { name: "description", content: "Ayat, lessons and words you have saved." },
      { property: "og:title", content: "Bookmarks — QuranRoots" },
      { property: "og:description", content: "Everything you saved, organised in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Bookmarks,
});

function Bookmarks() {
  const { d } = useI18n();
  const b = d.memorization.bookmarks;
  return (
    <RoadmapPage title={b.title} phase={b.phase} intro={b.intro} planned={b.planned} note={b.note} />
  );
}
