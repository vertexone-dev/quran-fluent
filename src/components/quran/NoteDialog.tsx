import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { createNote, updateNote, NOTE_MAX_LENGTH, type Note } from "@/lib/notes";

type NoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  surahNumber: number;
  ayahNumber: number;
  ayahLabel: string;
  /** Present = editing that note; absent = creating a new one. */
  note?: Note | null;
  onSaved: () => void;
};

export function NoteDialog({
  open,
  onOpenChange,
  userId,
  surahNumber,
  ayahNumber,
  ayahLabel,
  note,
  onSaved,
}: NoteDialogProps) {
  const { d } = useI18n();
  const n = d.notes;
  const [content, setContent] = useState(note?.content ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setContent(note?.content ?? "");
  }, [open, note]);

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (note) {
        await updateNote(userId, note.id, trimmed);
      } else {
        await createNote(userId, surahNumber, ayahNumber, trimmed);
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(n.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{note ? n.edit : n.add}</DialogTitle>
          <DialogDescription>{ayahLabel}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, NOTE_MAX_LENGTH))}
          placeholder={n.placeholder}
          rows={6}
          maxLength={NOTE_MAX_LENGTH}
          aria-label={note ? n.edit : n.add}
        />
        <p className="text-right text-xs text-muted-foreground">
          {content.length} / {NOTE_MAX_LENGTH}
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {n.cancel}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !content.trim()}>
            {n.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
