import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { fetchBookmarks, removeBookmark, type Bookmark } from "@/lib/bookmarks";
import { fetchSurahs, surahName } from "@/lib/quran";

export const Route = createFileRoute("/_authenticated/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks — QuranRoots" },
      { name: "description", content: "Ayat you have saved." },
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
  const { user } = useAuth();
  const { d, locale } = useI18n();
  const queryClient = useQueryClient();
  const b = d.bookmarks;
  const userId = user?.id;

  const {
    data: bookmarks,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["bookmarks", userId],
    queryFn: () => fetchBookmarks(userId!),
    enabled: Boolean(userId),
  });
  const { data: surahs } = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
  });

  const removeMutation = useMutation({
    mutationFn: (bookmark: Bookmark) =>
      removeBookmark(userId!, bookmark.surah_number, bookmark.ayah_number),
    onSuccess: () => {
      toast.success(b.removedToast);
      void queryClient.invalidateQueries({ queryKey: ["bookmarks", userId] });
      void queryClient.invalidateQueries({ queryKey: ["bookmarked-ayah-keys", userId] });
    },
    onError: () => toast.error(d.common.errors.generic),
  });

  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{b.title}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{b.intro}</p>

      {isLoading && (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}

      {isError && (
        <Card className="mt-8 shadow-soft">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">{b.error.title}</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              {b.error.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && bookmarks && bookmarks.length === 0 && (
        <Card className="mt-8 shadow-soft">
          <CardContent className="space-y-2 py-10 text-center">
            <p className="font-display text-lg font-semibold">{b.empty.title}</p>
            <p className="text-sm text-muted-foreground">{b.empty.body}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && bookmarks && bookmarks.length > 0 && (
        <div className="mt-8 space-y-4">
          {bookmarks.map((bookmark) => {
            const surah = surahs?.find((s) => s.number === bookmark.surah_number);
            return (
              <Card key={bookmark.id} className="shadow-soft">
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div className="min-w-0">
                    <p className="font-display font-semibold">
                      {surah ? surahName(surah, locale) : bookmark.surah_number}{" "}
                      {bookmark.surah_number}:{bookmark.ayah_number}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {b.savedOn.replace(
                        "{date}",
                        new Date(bookmark.created_at).toLocaleDateString(locale),
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to="/quran"
                        search={{ surah: bookmark.surah_number, ayah: bookmark.ayah_number }}
                      >
                        {b.openAyah}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(bookmark)}
                      disabled={removeMutation.isPending}
                    >
                      {b.remove}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
