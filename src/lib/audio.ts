/**
 * Centralized Qur'anic recitation audio: the ONE place that knows how to
 * resolve an āyah to a playable URL and the ONE place that owns the actual
 * <audio> element. Every consumer (Qur'an reader, lesson quran_example
 * sections, future listening exercises) goes through this module instead
 * of constructing its own Audio() instance or hard-coding a provider URL --
 * so there is exactly one thing playing at a time app-wide, and swapping
 * the provider or adding a second reciter later touches only this file.
 *
 * PROVIDER: api.quran.com (operated by Quran Foundation, formerly
 * Quran.com) -- a public, unauthenticated, CORS-open (verified:
 * access-control-allow-origin: *) developer API with an official
 * MIT-licensed SDK (@quranjs/api, github.com/quran/api-js), documented at
 * api-docs.quran.foundation. No API key/credential is required or
 * embedded, so there is nothing to leak in a client bundle. The reciters
 * already anticipated by the app's own settings page (mishary_alafasy,
 * abdulbasit_murattal, husary) were confirmed to map exactly onto this
 * API's own reciter IDs (7, 2, 6) and their Murattal/Mujawwad style
 * distinction, before this module was written -- not guessed. Resolved
 * audio files were confirmed live to serve over HTTPS as audio/mpeg with
 * `accept-ranges: bytes` (seekable) from Quran Foundation's own CDN
 * (audio.qurancdn.com) and its QuranicAudio.com mirror
 * (mirrors.quranicaudio.com), both properties of the same organization
 * (see github.com/quran/audio.quran.com).
 *
 * NOT persisted anywhere: no schema change, no new table. A reciter is a
 * small, rarely-changing lookup from a stable key to that provider's
 * numeric ID -- exactly the kind of thing a migration would be premature
 * for. If reciter metadata ever needs to be admin-editable or support a
 * provider-agnostic multi-source scheme, that upgrade only touches
 * `resolveAyahAudioUrl` below, never its callers.
 */

const AUDIO_API_BASE = "https://api.quran.com/api/v4";
const AUDIO_CDN_BASE = "https://audio.qurancdn.com/";

/** Keyed identically to the `value`s already used by the reciter <Select>
 * on the settings page (src/routes/_authenticated/settings.tsx) -- Phase 1
 * doesn't wire that preference up to playback yet (no reciter-selector UI
 * is in scope), but the key scheme already matches so doing so later is a
 * one-line change here, not a new design. */
export const RECITER_IDS = {
  mishary_alafasy: 7,
  abdulbasit_murattal: 2,
  husary: 6,
} as const;

export type ReciterKey = keyof typeof RECITER_IDS;

export const RECITER_NAMES: Record<ReciterKey, string> = {
  mishary_alafasy: "Mishary Rashid Alafasy",
  abdulbasit_murattal: "Abdul Basit (Murattal)",
  husary: "Mahmoud Khalil Al-Husary",
};

/** Phase 1 default -- the only reciter actually played, until a
 * reciter-selector UI (explicitly out of Phase 1 scope) exists. */
export const DEFAULT_RECITER: ReciterKey = "mishary_alafasy";

type AudioFilesResponse = {
  audio_files?: { url: string }[];
};

/** The API returns either a bare relative path (resolve against Quran
 * Foundation's own CDN) or a protocol-relative URL pointing at their
 * QuranicAudio.com mirror -- both confirmed live before this was written.
 * Never returns a bare path unresolved; never silently accepts http. */
function normalizeAudioUrl(url: string): string {
  if (url.startsWith("https://")) return url;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  if (url.startsWith("//")) return `https:${url}`;
  return `${AUDIO_CDN_BASE}${url}`;
}

/** Thrown specifically when the provider responds successfully but has no
 * audio file for this āyah/reciter combination -- distinct from a
 * network/provider failure so the UI can say "not available" rather than
 * the more alarming "try again" for a case retrying can never fix. */
export class AudioUnavailableError extends Error {}

/**
 * Resolves one āyah to a playable HTTPS URL for the given reciter.
 * Throws on any network/provider failure or an ayah with no audio file --
 * callers (only AyahAudioPlayer below, in practice) are expected to catch
 * this and surface the existing "error"/"unavailable" playback state
 * rather than letting it become an unhandled rejection.
 */
export async function resolveAyahAudioUrl(
  reciter: ReciterKey,
  surahNumber: number,
  ayahNumber: number,
  signal?: AbortSignal,
): Promise<string> {
  const reciterId = RECITER_IDS[reciter];
  const res = await fetch(
    `${AUDIO_API_BASE}/recitations/${reciterId}/by_ayah/${surahNumber}:${ayahNumber}`,
    signal ? { signal } : {},
  );
  if (!res.ok) {
    throw new Error(`Failed to resolve recitation audio: ${res.status}`);
  }
  const data = (await res.json()) as AudioFilesResponse;
  const file = data.audio_files?.[0];
  if (!file) {
    throw new AudioUnavailableError(
      `No recitation audio available for ${surahNumber}:${ayahNumber}`,
    );
  }
  return normalizeAudioUrl(file.url);
}

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";
export type ErrorReason = "unavailable" | "failed" | null;

export type AyahAudioState = {
  status: PlaybackStatus;
  surahNumber: number | null;
  ayahNumber: number | null;
  /** Only meaningful when status is "error" -- distinguishes "this āyah
   * genuinely has no recitation audio yet" (retrying won't help) from a
   * transient network/provider/playback failure (retrying might). */
  errorReason: ErrorReason;
};

type Listener = (state: AyahAudioState) => void;

const IDLE_STATE: AyahAudioState = {
  status: "idle",
  surahNumber: null,
  ayahNumber: null,
  errorReason: null,
};

/**
 * The single owner of the app's one shared <audio> element. Starting
 * playback on any āyah always stops whatever was previously playing
 * first, so overlapping recitations can never happen regardless of how
 * many AyahPlayButton instances are mounted across the page.
 *
 * `requestToken` guards every async boundary (URL resolution, play()'s
 * own promise) against being superseded by a newer request -- e.g. a user
 * clicking a second āyah's play button, or the same button rapidly,
 * before the first request settles. A superseded request's eventual
 * success or failure is silently dropped instead of corrupting the state
 * that now belongs to the newer request.
 */
class AyahAudioPlayer {
  private audioEl: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private state: AyahAudioState = IDLE_STATE;
  private requestToken = 0;

  private setState(patch: Partial<AyahAudioState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AyahAudioState {
    return this.state;
  }

  private getAudioEl(): HTMLAudioElement {
    if (this.audioEl) return this.audioEl;
    const el = new Audio();
    el.preload = "none";
    el.addEventListener("ended", () => this.setState({ status: "ended" }));
    el.addEventListener("error", () => {
      // A native media error (bad file, network drop mid-stream, etc.) on
      // the element currently backing playback -- always relevant, since
      // this element is only ever pointed at the current request's URL.
      this.setState({ status: "error", errorReason: "failed" });
    });
    this.audioEl = el;
    return el;
  }

  /** Starts (or resumes) playback of one āyah for one reciter. Safe to
   * call repeatedly/rapidly -- see class doc for the token-guard logic. */
  async play(reciter: ReciterKey, surahNumber: number, ayahNumber: number): Promise<void> {
    const isSameAyah =
      this.state.surahNumber === surahNumber && this.state.ayahNumber === ayahNumber;
    const el = this.getAudioEl();

    if (isSameAyah && this.state.status === "paused") {
      const token = ++this.requestToken;
      try {
        await el.play();
        if (token !== this.requestToken) return;
        this.setState({ status: "playing", errorReason: null });
      } catch {
        if (token !== this.requestToken) return;
        this.setState({ status: "error", errorReason: "failed" });
      }
      return;
    }

    const token = ++this.requestToken;
    el.pause();
    this.setState({ status: "loading", surahNumber, ayahNumber, errorReason: null });

    let url: string;
    try {
      url = await resolveAyahAudioUrl(reciter, surahNumber, ayahNumber);
    } catch (err) {
      if (token !== this.requestToken) return;
      const reason: ErrorReason = err instanceof AudioUnavailableError ? "unavailable" : "failed";
      this.setState({ status: "error", errorReason: reason });
      return;
    }
    if (token !== this.requestToken) return;

    el.src = url;
    try {
      await el.play();
      if (token !== this.requestToken) return;
      this.setState({ status: "playing", errorReason: null });
    } catch {
      if (token !== this.requestToken) return;
      this.setState({ status: "error", errorReason: "failed" });
    }
  }

  /** Restarts the given āyah from the beginning -- identical to play()
   * for a different āyah, but seeks to 0 first when it's already the
   * active one (so "replay" after `ended` doesn't no-op). */
  restart(reciter: ReciterKey, surahNumber: number, ayahNumber: number): Promise<void> {
    const isSameAyah =
      this.state.surahNumber === surahNumber && this.state.ayahNumber === ayahNumber;
    if (isSameAyah && this.audioEl) this.audioEl.currentTime = 0;
    if (isSameAyah && this.state.status !== "idle") {
      // Force play()'s "resume" branch to be skipped so it re-fetches
      // nothing but does re-issue play() from the seeked position.
      this.state = { ...this.state, status: "ended" };
    }
    return this.play(reciter, surahNumber, ayahNumber);
  }

  pause(): void {
    if (this.state.status !== "playing") return;
    this.audioEl?.pause();
    this.setState({ status: "paused" });
  }

  /** Stops playback entirely and invalidates any in-flight request --
   * used when navigating away from a page that had audio playing. */
  stop(): void {
    this.requestToken++;
    this.audioEl?.pause();
    this.state = IDLE_STATE;
    for (const listener of this.listeners) listener(this.state);
  }
}

export const ayahAudioPlayer = new AyahAudioPlayer();
