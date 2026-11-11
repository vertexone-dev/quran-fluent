import { useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CinematicButton } from "@/design/CinematicButton";
import { useI18n } from "@/lib/i18n";
import { surahName, type Surah } from "@/lib/quran";

// QR-INT-007 (Milestone C): sticky Reader navigation -- Surah picker,
// previous/next Surah and "go to Ayah". Driven entirely by the surah rows the
// database returns (number + ayah_count), so it works for the full 114-Surah
// Mushaf with no hard-coded limits. The Surah <Select> keeps its existing
// accessible name ("Select a Surah"), which specs 06/50 rely on.
export function ReaderToolbar({
  surahs,
  activeSurah,
  onSurahChange,
  onJumpToAyah,
}: {
  surahs: Surah[];
  activeSurah: Surah | undefined;
  onSurahChange: (surahNumber: number) => void;
  onJumpToAyah: (ayahNumber: number) => void;
}) {
  const { d, locale } = useI18n();
  const ui = d.quran.readerUi;
  const [jump, setJump] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const index = activeSurah ? surahs.findIndex((s) => s.number === activeSurah.number) : -1;
  const prev = index > 0 ? surahs[index - 1] : undefined;
  const next = index >= 0 && index < surahs.length - 1 ? surahs[index + 1] : undefined;

  const submitJump = (event: FormEvent) => {
    event.preventDefault();
    if (!activeSurah) return;
    const n = Number(jump);
    if (!Number.isInteger(n) || n < 1 || n > activeSurah.ayah_count) {
      setJumpError(ui.jumpInvalid.replace("{max}", String(activeSurah.ayah_count)));
      return;
    }
    setJumpError(null);
    onJumpToAyah(n);
  };

  return (
    <nav
      aria-label={ui.toolbarLabel}
      data-testid="reader-toolbar"
      className="nav-glass-dense rounded-[22px] p-3 text-white sm:p-4"
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <CinematicButton
          variant="icon"
          size="icon"
          aria-label={ui.prevSurah}
          title={ui.prevSurah}
          disabled={!prev}
          onClick={() => prev && onSurahChange(prev.number)}
          data-testid="reader-prev-surah"
        >
          <ChevronLeft className="dir-icon" aria-hidden />
        </CinematicButton>
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <Select
            {...(activeSurah ? { value: String(activeSurah.number) } : {})}
            onValueChange={(value) => onSurahChange(Number(value))}
          >
            <SelectTrigger
              aria-label={d.quran.reader.selectSurah}
              className="min-h-11 rounded-full border-white/20 bg-white/5 text-white"
            >
              <SelectValue placeholder={d.quran.reader.selectSurah} />
            </SelectTrigger>
            <SelectContent>
              {surahs.map((s) => (
                <SelectItem key={s.number} value={String(s.number)}>
                  {s.number}. {surahName(s, locale)} ({s.ayah_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CinematicButton
          variant="icon"
          size="icon"
          aria-label={ui.nextSurah}
          title={ui.nextSurah}
          disabled={!next}
          onClick={() => next && onSurahChange(next.number)}
          data-testid="reader-next-surah"
        >
          <ChevronRight className="dir-icon" aria-hidden />
        </CinematicButton>
        <form onSubmit={submitJump} className="flex items-center gap-2" noValidate>
          <label htmlFor="reader-jump" className="sr-only">
            {ui.jumpLabel}
          </label>
          <Input
            id="reader-jump"
            inputMode="numeric"
            placeholder={ui.jumpLabel}
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/[^0-9]/g, ""))}
            aria-invalid={jumpError ? true : undefined}
            aria-describedby={jumpError ? "reader-jump-error" : undefined}
            className="min-h-11 w-32 rounded-full border-white/20 bg-white/5 text-white placeholder:text-white/60"
            data-testid="reader-jump-input"
            disabled={!activeSurah}
          />
          <CinematicButton
            variant="ghost"
            size="md"
            type="submit"
            disabled={!activeSurah}
            data-testid="reader-jump-go"
          >
            {ui.jumpGo}
          </CinematicButton>
        </form>
      </div>
      {jumpError && (
        <p
          id="reader-jump-error"
          role="alert"
          className="mt-2 text-sm text-amber-200"
          data-testid="reader-jump-error"
        >
          {jumpError}
        </p>
      )}
    </nav>
  );
}
