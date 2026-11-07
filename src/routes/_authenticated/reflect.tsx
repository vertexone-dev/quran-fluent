import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createNote, deleteNote, fetchNotesForAyah, NOTE_MAX_LENGTH, type Note } from "@/lib/notes";
import { ayahTranslation, fetchAyah, fetchSurah, surahName } from "@/lib/quran";
import { NoteDialog } from "@/components/quran/NoteDialog";

const searchSchema = z.object({
  surah: z.number().int().positive().optional(),
  ayah: z.number().int().positive().optional(),
});

export const Route = createFileRoute("/_authenticated/reflect")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Reflect — QuranRoots" },
      { name: "description", content: "Reflect on an Ayah with guided prompts." },
      { property: "og:title", content: "Reflect — QuranRoots" },
      { property: "og:description", content: "Guided reflection prompts on the Qur'an." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Reflect,
});

function Reflect() {
  const { user } = useAuth();
  const search = Route.useSearch();

  if (!user) return null;

  if (search.surah && search.ayah) {
    return <ReflectOnAyah userId={user.id} surahNumber={search.surah} ayahNumber={search.ayah} />;
  }

  return <ReflectEmpty />;
}

function ReflectEmpty() {
  const { d } = useI18n();
  const r = d.reflect;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-center">
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{r.title}</h1>
      <p className="mt-3 text-muted-foreground">{r.subtitle}</p>

      <Card className="mt-8 shadow-soft">
        <CardContent className="space-y-4 py-10">
          <p className="font-display text-lg font-semibold">{r.noAyah.title}</p>
          <p className="text-sm text-muted-foreground">{r.noAyah.body}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/quran">{r.noAyah.cta}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/notes">{r.viewAllNotes}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function ReflectOnAyah({
  userId,
  surahNumber,
  ayahNumber,
}: {
  userId: string;
  surahNumber: number;
  ayahNumber: number;
}) {
  const { d, locale } = useI18n();
  const r = d.reflect;
  const queryClient = useQueryClient();

  const [promptIndex, setPromptIndex] = useState(-1);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);

  const question =
    promptIndex < 0 ? r.defaultQuestion : (r.prompts[promptIndex]?.question ?? r.defaultQuestion);

  const { data: surah } = useQuery({
    queryKey: ["surah", surahNumber],
    queryFn: () => fetchSurah(surahNumber),
  });

  const { data: ayah, isLoading: ayahLoading } = useQuery({
    queryKey: ["ayah", surahNumber, ayahNumber],
    queryFn: () => fetchAyah(surahNumber, ayahNumber),
  });

  const notesKey = ["notes-for-ayah", userId, surahNumber, ayahNumber];
  const {
    data: notes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: notesKey,
    queryFn: () => fetchNotesForAyah(userId, surahNumber, ayahNumber),
    // Same retry/reconnect fix as /notes (src/routes/_authenticated/notes.tsx):
    // the default (3 retries, exponential backoff, refetchOnReconnect) left
    // this page showing only its loading skeleton for a long stretch before
    // isError ever got a chance to render.
    retry: 1,
    refetchOnReconnect: false,
  });

  function invalidateNotes() {
    void queryClient.invalidateQueries({ queryKey: notesKey });
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
  }

  const saveMutation = useMutation({
    mutationFn: (content: string) => createNote(userId, surahNumber, ayahNumber, content),
    onSuccess: () => {
      setText("");
      invalidateNotes();
      toast.success(r.saved);
    },
    onError: () => toast.error(r.saveError),
  });

  const deleteMutation = useMutation({
    mutationFn: (note: Note) => deleteNote(userId, note.id),
    onSuccess: () => {
      invalidateNotes();
      setDeleting(null);
    },
    onError: () => toast.error(r.deleteError),
  });

  const surahLabel = surah
    ? `${surahName(surah, locale)} ${surahNumber}:${ayahNumber}`
    : `${surahNumber}:${ayahNumber}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{r.title}</h1>
      <p className="mt-3 text-muted-foreground">{r.subtitle}</p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div>
          <Card className="shadow-soft border-l-4 border-l-gold">
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold">{r.cardTitle}</h2>
                <Badge variant="outline" className="gap-1.5" data-testid="reflection-ayah-badge">
                  <Sparkles className="size-3.5 text-gold" aria-hidden />
                  <span dir="ltr">{surahLabel}</span>
                </Badge>
              </div>

              {ayahLoading && <Skeleton className="h-16 w-full" />}
              {!ayahLoading && ayah && (
                <div className="space-y-2">
                  <p
                    className="text-quran text-right text-2xl leading-loose text-foreground"
                    dir="rtl"
                    lang="ar"
                  >
                    {ayah.arabic_text}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {ayahTranslation(ayah, locale) ?? d.quran.reader.translationUnavailable}
                  </p>
                </div>
              )}
              {!ayahLoading && !ayah && (
                <p className="text-sm text-muted-foreground">{r.ayahUnavailable}</p>
              )}

              <p className="text-base text-foreground" data-testid="reflection-question">
                {question}
              </p>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                placeholder={r.placeholder}
                rows={5}
                maxLength={NOTE_MAX_LENGTH}
                aria-label={r.cardTitle}
                data-testid="reflection-textarea"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {text.length} / {NOTE_MAX_LENGTH}
                </p>
                <Button
                  disabled={!text.trim() || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(text.trim())}
                  data-testid="reflection-save-button"
                >
                  {r.save}
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="mb-3 mt-6 text-sm font-semibold text-foreground">{r.promptsLabel}</p>
          <div className="flex flex-wrap gap-2" data-testid="reflection-prompts">
            {r.prompts.map((pr, i) => (
              <button
                key={pr.label}
                type="button"
                onClick={() => setPromptIndex(i === promptIndex ? -1 : i)}
                aria-pressed={i === promptIndex}
                data-testid={`reflection-prompt-${i}`}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  i === promptIndex
                    ? "border-gold bg-gold/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="shadow-soft">
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-display text-xl font-bold">{r.notesTitle}</h2>

            {isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {isError && (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">{r.error.title}</p>
                <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                  {r.error.retry}
                </Button>
              </div>
            )}

            {!isLoading && !isError && notes && notes.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {r.empty}
              </p>
            )}

            {!isLoading && !isError && notes && notes.length > 0 && (
              <ul className="space-y-3" data-testid="notes-list">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-2xl border border-border bg-muted/40 p-4"
                    data-testid="note-item"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(note.created_at).toLocaleDateString(locale)}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={r.edit}
                          title={r.edit}
                          onClick={() => setEditing(note)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={r.del}
                          title={r.del}
                          onClick={() => setDeleting(note)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="outline" size="sm" asChild>
              <Link to="/quran" search={{ surah: surahNumber, ayah: ayahNumber }}>
                {r.openAyah}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {editing && (
        <NoteDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          userId={userId}
          surahNumber={surahNumber}
          ayahNumber={ayahNumber}
          ayahLabel={surahLabel}
          note={editing}
          onSaved={() => {
            invalidateNotes();
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{r.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{r.deleteConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{r.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting)}>
              {r.del}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
