import { useEffect, useState } from "react";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { ayahAudioPlayer, DEFAULT_RECITER, type AyahAudioState } from "@/lib/audio";

type AyahPlayButtonProps = {
  surahNumber: number;
  ayahNumber: number;
};

function useAyahAudioState(): AyahAudioState {
  const [state, setState] = useState(ayahAudioPlayer.getState());
  useEffect(() => ayahAudioPlayer.subscribe(setState), []);
  return state;
}

/**
 * Reusable play/pause/replay control for one āyah, backed by the single
 * app-wide `ayahAudioPlayer` (src/lib/audio.ts). Every consumer (Qur'an
 * reader, lesson quran_example sections) renders one of these per āyah;
 * only the one whose (surahNumber, ayahNumber) matches the player's
 * current state ever shows anything other than the idle "Play" button, so
 * starting playback here never leaves a stale "Pause" button showing
 * elsewhere on the page for an āyah that already stopped.
 */
export function AyahPlayButton({ surahNumber, ayahNumber }: AyahPlayButtonProps) {
  const { d } = useI18n();
  const copy = d.quran.audio;
  const state = useAyahAudioState();
  const isActive = state.surahNumber === surahNumber && state.ayahNumber === ayahNumber;
  const status = isActive ? state.status : "idle";

  if (status === "loading") {
    return (
      <Button variant="ghost" size="icon" disabled aria-label={copy.loading} title={copy.loading}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </Button>
    );
  }

  if (status === "playing") {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={copy.pause}
        title={copy.pause}
        onClick={() => ayahAudioPlayer.pause()}
      >
        <Pause className="size-4" aria-hidden />
      </Button>
    );
  }

  if (status === "paused" || status === "ended") {
    const label = status === "ended" ? copy.restart : copy.play;
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        onClick={() =>
          void (status === "ended"
            ? ayahAudioPlayer.restart(DEFAULT_RECITER, surahNumber, ayahNumber)
            : ayahAudioPlayer.play(DEFAULT_RECITER, surahNumber, ayahNumber))
        }
      >
        {status === "ended" ? (
          <RotateCcw className="size-4" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
      </Button>
    );
  }

  if (status === "error") {
    const isUnavailable = isActive && state.errorReason === "unavailable";
    const label = isUnavailable ? copy.unavailable : copy.error;
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        disabled={isUnavailable}
        onClick={() => void ayahAudioPlayer.play(DEFAULT_RECITER, surahNumber, ayahNumber)}
      >
        <Play className="size-4 text-destructive" aria-hidden />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={copy.play}
      title={copy.play}
      onClick={() => void ayahAudioPlayer.play(DEFAULT_RECITER, surahNumber, ayahNumber)}
    >
      <Play className="size-4" aria-hidden />
    </Button>
  );
}
