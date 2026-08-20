import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { deleteNote, fetchNotes, type Note } from "@/lib/notes";
import { fetchSurahs, surahName } from "@/lib/quran";
import { NoteDialog } from "@/components/quran/NoteDialog";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes — QuranRoots" },
      { name: "description", content: "Your private study notes on Ayat." },
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
  const { user } = useAuth();
  const { d, locale } = useI18n();
  const queryClient = useQueryClient();
  const n = d.notes;
  const [editing, setEditing] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);

  const userId = user?.id;

  const {
    data: notes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["notes", userId],
    queryFn: () => fetchNotes(userId!),
    enabled: Boolean(userId),
  });
  const { data: surahs } = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
  });

  const deleteMutation = useMutation({
    mutationFn: (note: Note) => deleteNote(userId!, note.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes", userId] });
      setDeleting(null);
    },
    onError: () => toast.error(n.deleteError),
  });

  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{n.title}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{n.intro}</p>

      {isLoading && (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <Card className="mt-8 shadow-soft">
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-muted-foreground">{n.error.title}</p>
            <Button variant="secondary" onClick={() => void refetch()}>
              {n.error.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && notes && notes.length === 0 && (
        <Card className="mt-8 shadow-soft">
          <CardContent className="space-y-2 py-10 text-center">
            <p className="font-display text-lg font-semibold">{n.empty.title}</p>
            <p className="text-sm text-muted-foreground">{n.empty.body}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && notes && notes.length > 0 && (
        <div className="mt-8 space-y-4">
          {notes.map((note) => {
            const surah = surahs?.find((s) => s.number === note.surah_number);
            return (
              <Card key={note.id} className="shadow-soft">
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display font-semibold">
                        {surah ? surahName(surah, locale) : note.surah_number} {note.surah_number}:
                        {note.ayah_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {n.updatedOn.replace(
                          "{date}",
                          new Date(note.updated_at).toLocaleDateString(locale),
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to="/quran"
                        search={{ surah: note.surah_number, ayah: note.ayah_number }}
                      >
                        {n.openAyah}
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(note)}>
                      {n.edit}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(note)}>
                      {n.delete}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <NoteDialog
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          userId={user.id}
          surahNumber={editing.surah_number}
          ayahNumber={editing.ayah_number}
          ayahLabel={`${editing.surah_number}:${editing.ayah_number}`}
          note={editing}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["notes", userId] })}
        />
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{n.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{n.deleteConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{n.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting)}>
              {n.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
