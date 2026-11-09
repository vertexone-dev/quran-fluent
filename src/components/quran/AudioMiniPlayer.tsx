import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";

import { CinematicButton } from "@/design/CinematicButton";
import { useAuth } from "@/lib/auth";
import { ayahAudioPlayer, reciterLabel } from "@/lib/audio";
import { useI18n } from "@/lib/i18n";
import { fetchSurahs, surahName } from "@/lib/quran";
import { useAyahAudioState, usePreferredReciter } from "./AyahPlayButton";

// QR-INT-007 (Milestone C): sticky recitation mini-player. Purely a second
// view onto the existing single app-wide `ayahAudioPlayer` (src/lib/audio.ts)
// -- it never creates audio, never hard-codes a provider, and uses the same
// usePreferredReciter gate as AyahPlayButton so it can't start playback with
// the wrong reciter. Hidden while the player is idle. The reciter itself is
// changed in Settings (existing behaviour), not here.
export function AudioMiniPlayer() {
  const { d, locale } = useI18n();
  const m = d.quran.miniPlayer;
  const a = d.quran.audio;
  const { user } = useAuth();
  const state = useAyahAudioState();
  const { reciter, isReady } = usePreferredReciter();
  const { data: surahs } = useQuery({
    queryKey: ["surahs"],
    queryFn: ({ signal }) => fetchSurahs(signal),
  });

  if (state.status === "idle" || state.surahNumber == null || state.ayahNumber == null) return null;
  const s = state.surahNumber;
  const n = state.ayahNumber;
  const surah = surahs?.find((row) => row.number === s);
  const hasNext = surah ? n < surah.ayah_count : false;
  const statusText =
    state.status === "loading"
      ? m.loading
      : state.status === "playing"
        ? m.playing
        : state.status === "paused"
          ? m.paused
          : state.status === "ended"
            ? m.ended
            : state.errorReason === "unavailable"
              ? a.unavailable
              : a.error;

  return (
    <aside
      aria-label={m.label}
      data-testid="audio-mini-player"
      className="nav-glass-dense fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-2xl rounded-[22px] px-4 py-3 text-white motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 xl:bottom-6"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" data-testid="audio-mini-player-title">
            {m.nowPlaying
              .replace("{surah}", surah ? surahName(surah, locale) : String(s))
              .replace("{ayah}", String(n))}
          </p>
          <p
            className="truncate text-xs text-white/80"
            aria-live="polite"
            data-testid="audio-mini-player-status"
          >
            {statusText} · {m.reciter.replace("{reciter}", reciterLabel(reciter, locale))}
            {user && (
              <>
                {" · "}
                <Link to="/settings" className="underline-offset-2 hover:underline">
                  {m.changeReciter}
                </Link>
              </>
            )}
          </p>
        </div>
        {state.status === "playing" ? (
          <CinematicButton
            variant="gold"
            size="icon"
            aria-label={m.pause}
            title={m.pause}
            onClick={() => ayahAudioPlayer.pause()}
            data-testid="audio-mini-player-pause"
          >
            <Pause aria-hidden />
          </CinematicButton>
        ) : state.status === "loading" ? (
          <CinematicButton variant="gold" size="icon" aria-label={m.loading} disabled>
            <Loader2 className="motion-safe:animate-spin" aria-hidden />
          </CinematicButton>
        ) : (
          <CinematicButton
            variant="gold"
            size="icon"
            aria-label={state.status === "paused" ? m.resume : m.replay}
            title={state.status === "paused" ? m.resume : m.replay}
            disabled={!isReady}
            onClick={() =>
              state.status === "paused"
                ? void ayahAudioPlayer.play(reciter, s, n)
                : void ayahAudioPlayer.restart(reciter, s, n)
            }
            data-testid="audio-mini-player-play"
          >
            {state.status === "paused" ? <Play aria-hidden /> : <RotateCcw aria-hidden />}
          </CinematicButton>
        )}
        <CinematicButton
          variant="icon"
          size="icon"
          aria-label={m.next}
          title={m.next}
          disabled={!hasNext || !isReady}
          onClick={() => void ayahAudioPlayer.play(reciter, s, n + 1)}
          data-testid="audio-mini-player-next"
        >
          <SkipForward className="dir-icon" aria-hidden />
        </CinematicButton>
        <CinematicButton
          variant="quiet"
          size="icon"
          aria-label={m.close}
          title={m.close}
          onClick={() => ayahAudioPlayer.stop()}
          data-testid="audio-mini-player-close"
        >
          <X aria-hidden />
        </CinematicButton>
      </div>
    </aside>
  );
}
