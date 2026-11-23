/**
 * Guards for exporting the Quran content from a DISPOSABLE local database
 * (QR-DESIGN-007E). Used by `export-content-db.mjs --target disposable`.
 *
 * The export script's default (production) behaviour is unchanged. The disposable
 * mode exists so the full database can be rebuilt from the repository's own migrations
 * in a throwaway Postgres + PostgREST pair and compared with the approved one, with no
 * production access. These rules make it impossible to point it at anything else:
 *
 *   - the URL must be plain-http loopback (127.0.0.1) with an explicit port;
 *   - that port must not be in 54320-54329, which is the range of the owner's
 *     long-running local Supabase stack (and of `supabase start` defaults);
 *   - an anon key must be supplied through the environment, never a file;
 *   - an explicit output directory is required, outside the repository, and never
 *     a path containing `content-db` or `quran-content` (the approved database);
 *   - the caller must not copy the result into mobile/public/.
 */
import path from "node:path";

export const OWNER_STACK_PORTS = [54320, 54329];

export function resolveDisposableTarget({ url, key, out, repoRoot }) {
  if (!url || !/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(url)) {
    throw new Error(
      "disposable target: QR_DISPOSABLE_SUPABASE_URL must be http://127.0.0.1:<port>",
    );
  }
  const port = Number(url.split(":")[2]);
  if (port >= OWNER_STACK_PORTS[0] && port <= OWNER_STACK_PORTS[1]) {
    throw new Error(
      `disposable target: port ${port} is in the owner's local Supabase range (54320-54329)`,
    );
  }
  if (!key) throw new Error("disposable target: QR_DISPOSABLE_ANON_KEY is required");
  if (!out) throw new Error("disposable target: --out <directory> is required");
  const outDir = path.resolve(out);
  const rel = path.relative(repoRoot, outDir);
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    throw new Error(`disposable target: --out must be outside the repository (got ${outDir})`);
  }
  if (/content-db|quran-content/.test(outDir)) {
    throw new Error(`disposable target: --out must not point at approved content (${outDir})`);
  }
  return { url, key, outDir };
}
