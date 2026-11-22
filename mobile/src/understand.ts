export type AyahRef = { surah: number; ayah: number };
type SurahLike = { number: number; ayah_count: number };

/** Previous / next ayah across surah boundaries, driven only by the bundled
 * database's own surah rows (number + ayah_count): no hard-coded 114/6236. */
export function neighbouringAyahs(
  surahs: SurahLike[],
  ref: AyahRef,
): { prev: AyahRef | null; next: AyahRef | null } {
  const i = surahs.findIndex((s) => s.number === ref.surah);
  const current = surahs[i];
  if (!current || ref.ayah < 1 || ref.ayah > current.ayah_count) return { prev: null, next: null };
  const before = surahs[i - 1];
  const after = surahs[i + 1];
  const prev =
    ref.ayah > 1
      ? { surah: ref.surah, ayah: ref.ayah - 1 }
      : before
        ? { surah: before.number, ayah: before.ayah_count }
        : null;
  const next =
    ref.ayah < current.ayah_count
      ? { surah: ref.surah, ayah: ref.ayah + 1 }
      : after
        ? { surah: after.number, ayah: 1 }
        : null;
  return { prev, next };
}
