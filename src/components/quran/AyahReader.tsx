import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, BookOpen, Check, NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  fetchAyahsWithTranslations,
  fetchBismillahText,
  fetchSurahs,
  surahName,
} from "@/lib/quran";
import { addBookmark, fetchBookmarkedAyahKeys, removeBookmark } from "@/lib/bookmarks";
import { AyahCard } from "./AyahCard";
import { AyahPlayButton } from "./AyahPlayButton";
import { NoteDialog } from "./NoteDialog";

type AyahReaderProps = {
  surahNumber: number | undefined;
  onSurahChange: (surahNumber: number) => void;
  highlightAyah?: number | undefined;
};

// How long the bookmark-confirmation checkmark stays visible before it's
// cleared -- long enough to register as a deliberate acknowledgment, short
// enough not to linger once the learner has moved on. The 300ms it takes to
// pop in (see the "animate-in zoom-in-50" usage below) is the same duration
// the lesson-completion checkmark and the level-card hover transition use.
const BOOKMARK_CONFIRM_MS = 1400;

export function AyahReader({ surahNumber, onSurahChange, highlightAyah }: AyahReaderProps) {
  const { d, locale } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const r = d.quran.reader;
  const [noteTarget, setNoteTarget] = useState<{ surah: number; ayah: number } | null>(null);
  // "Selected" (a soft highlight on the card the learner just acted on) and
  // "confirmed" (the bookmark checkmark, shown only once the save actually
  // succeeds -- never on the optimistic update below) are deliberately
  // separate: selecting an āyah happens the instant you interact with it,
  // confirmation only after the network round-trip resolves.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    };
  }, []);

  const { data: surahs } = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
  });

  const activeSurah = surahNumber ?? surahs?.[0]?.number;
  const activeSurahRow = surahs?.find((s) => s.number === activeSurah);

  // Only surahs whose ayah 1 doesn't already include the Bismillah need a
  // separate header for it (Al-Fatiha's ayah 1 IS the Bismillah — see the
  // migration comment on surahs.bismillah_pre).
  const { data: bismillahText } = useQuery({
    queryKey: ["bismillah-text"],
    queryFn: ({ signal }) => fetchBismillahText(signal),
    enabled: Boolean(activeSurahRow?.bismillah_pre),
    staleTime: Infinity,
  });

  const {
    data: ayahs,
    isLoading: ayahsLoading,
    isError: ayahsError,
    refetch: refetchAyahs,
  } = useQuery({
    queryKey: ["ayahs", activeSurah, locale],
    queryFn: ({ signal }) => fetchAyahsWithTranslations(activeSurah!, locale, signal),
    enabled: activeSurah != null,
  });

  const bookmarksKey = ["bookmarked-ayah-keys", user?.id];
  const { data: bookmarkedKeys } = useQuery({
    queryKey: bookmarksKey,
    queryFn: () => (user ? fetchBookmarkedAyahKeys(user.id) : Promise.resolve(new Set<string>())),
    enabled: Boolean(user),
  });

  const toggleBookmark = useMutation({
    mutationFn: async ({
      surah,
      ayah,
      bookmarked,
    }: {
      surah: number;
      ayah: number;
      bookmarked: boolean;
    }) => {
      if (!user) throw new Error("unauthenticated");
      if (bookmarked) await removeBookmark(user.id, surah, ayah);
      else await addBookmark(user.id, surah, ayah);
    },
    onMutate: async ({ surah, ayah, bookmarked }) => {
      await queryClient.cancelQueries({ queryKey: bookmarksKey });
      const previous = queryClient.getQueryData<Set<string>>(bookmarksKey);
      const next = new Set(previous ?? []);
      const key = `${surah}:${ayah}`;
      if (bookmarked) next.delete(key);
      else next.add(key);
      queryClient.setQueryData(bookmarksKey, next);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(bookmarksKey, context.previous);
      toast.error(d.common.errors.generic);
    },
    onSuccess: (_data, { surah, ayah, bookmarked }) => {
      toast.success(bookmarked ? d.bookmarks.removedToast : d.bookmarks.addedToast);
      // Only the save that just *added* a bookmark gets the checkmark --
      // `bookmarked` here is the state being toggled away from, so
      // `!bookmarked` means this call added one. Gated on this onSuccess
      // callback specifically, never on onMutate's optimistic update
      // above, so it can only ever appear once the write has actually
      // landed.
      if (!bookmarked) {
        const key = `${surah}:${ayah}`;
        if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
        setConfirmedKey(key);
        confirmTimeoutRef.current = setTimeout(() => setConfirmedKey(null), BOOKMARK_CONFIRM_MS);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bookmarksKey });
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });

  return (
    <section aria-labelledby="reader">
      <h2 id="reader" className="font-display text-2xl font-bold">
        {r.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{r.intro}</p>

      <div className="mt-6 max-w-sm">
        <Select
          {...(activeSurah != null ? { value: String(activeSurah) } : {})}
          onValueChange={(value) => onSurahChange(Number(value))}
        >
          <SelectTrigger aria-label={r.selectSurah}>
            <SelectValue placeholder={r.selectSurah} />
          </SelectTrigger>
          <SelectContent>
            {(surahs ?? []).map((s) => (
              <SelectItem key={s.number} value={String(s.number)}>
                {surahName(s, locale)} ({s.ayah_count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-4">
        {ayahsLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {ayahsError && (
          <Card className="shadow-soft">
            <CardContent className="space-y-3 py-8 text-center">
              <p className="text-muted-foreground">{r.error.title}</p>
              <Button variant="secondary" onClick={() => void refetchAyahs()}>
                {r.error.retry}
              </Button>
            </CardContent>
          </Card>
        )}

        {!ayahsLoading && !ayahsError && activeSurahRow?.bismillah_pre && bismillahText && (
          <p className="text-quran text-center text-xl text-foreground" dir="rtl" lang="ar">
            {bismillahText}
          </p>
        )}

        {!ayahsLoading &&
          !ayahsError &&
          activeSurahRow &&
          (ayahs ?? []).map((ayah) => {
            const key = `${ayah.surah_number}:${ayah.ayah_number}`;
            const isBookmarked = bookmarkedKeys?.has(key) ?? false;
            return (
              <AyahCard
                key={ayah.id}
                ayah={ayah}
                surahLabel={`${surahName(activeSurahRow, locale)} ${ayah.surah_number}:${ayah.ayah_number}`}
                highlighted={highlightAyah === ayah.ayah_number}
                selected={selectedKey === key}
                actions={
                  <>
                    <AyahPlayButton surahNumber={ayah.surah_number} ayahNumber={ayah.ayah_number} />
                    {user && (
                      <>
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={isBookmarked ? d.bookmarks.remove : d.bookmarks.add}
                            title={isBookmarked ? d.bookmarks.remove : d.bookmarks.add}
                            disabled={toggleBookmark.isPending}
                            onClick={() => {
                              setSelectedKey(key);
                              toggleBookmark.mutate({
                                surah: ayah.surah_number,
                                ayah: ayah.ayah_number,
                                bookmarked: isBookmarked,
                              });
                            }}
                          >
                            {isBookmarked ? (
                              <BookmarkCheck className="size-4 text-primary" aria-hidden />
                            ) : (
                              <Bookmark className="size-4" aria-hidden />
                            )}
                          </Button>
                          {/* Confirmation badge: absolutely positioned so it
                              overlays rather than pushes the row -- nothing
                              here ever shifts layout. Only ever rendered
                              once toggleBookmark's onSuccess has actually
                              set confirmedKey (see above), never on the
                              optimistic isBookmarked flip. Conditionally
                              mounted (not a class toggled on a
                              permanently-present node), so the pop-in can
                              only ever play once per confirmation, not
                              replay on an unrelated re-render. */}
                          {confirmedKey === key && (
                            <span
                              aria-hidden
                              data-testid="bookmark-confirmed"
                              className="animate-in zoom-in-50 fade-in-0 bg-primary text-primary-foreground pointer-events-none absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full duration-300 ease-out"
                            >
                              <Check className="size-3" />
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={r.actions.addNote}
                          title={r.actions.addNote}
                          onClick={() =>
                            setNoteTarget({ surah: ayah.surah_number, ayah: ayah.ayah_number })
                          }
                        >
                          <NotebookPen className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={r.actions.memorize}
                          title={r.actions.memorize}
                          asChild
                        >
                          <Link
                            to="/memorize"
                            search={{ surah: ayah.surah_number, ayah: ayah.ayah_number }}
                          >
                            <BookOpen className="size-4" aria-hidden />
                          </Link>
                        </Button>
                      </>
                    )}
                  </>
                }
              />
            );
          })}
      </div>

      {noteTarget && (
        <NoteDialog
          open={Boolean(noteTarget)}
          onOpenChange={(open) => !open && setNoteTarget(null)}
          userId={user!.id}
          surahNumber={noteTarget.surah}
          ayahNumber={noteTarget.ayah}
          ayahLabel={
            activeSurahRow
              ? `${surahName(activeSurahRow, locale)} ${noteTarget.surah}:${noteTarget.ayah}`
              : ""
          }
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["notes"] });
            toast.success(d.notes.add);
          }}
        />
      )}
    </section>
  );
}
