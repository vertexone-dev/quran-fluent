import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * QR-DESIGN-007E. A verification script that is started through a symlinked path (macOS
 * temp directories live under /var, a symlink to /private/var) must still run its main(),
 * not silently exit 0. Each script is started with no arguments both by its real path and
 * through a symlinked directory; the exit code and output must match and be non-empty
 * (with no arguments every one of them prints a usage line, a verdict or an error).
 */
const SCRIPTS = [
  "assert-no-skips.mjs",
  "verify-content-db.mjs",
  "release-art-guard.mjs",
  "rebuild-content-core.mjs",
  "full-rebuild/full-content-fingerprint.mjs",
];

function run(file: string, dirs: string[]) {
  const r = spawnSync(process.execPath, ["--no-warnings", file], {
    encoding: "utf8",
    cwd: os.tmpdir(),
  });
  let out = `${r.stdout}${r.stderr}`.replace(/\s+$/, "");
  // Stack traces embed the script directory (real or symlinked) and the verifier's random
  // temp directory; compare behaviour, not paths.
  for (const d of dirs) out = out.split(d).join("<scripts>");
  out = out.replace(/qr-verify-[A-Za-z0-9]+/g, "qr-verify-<id>");
  return { status: r.status, out };
}

describe("entrypoint guard resolves symlinks", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "qr-entry-"));
  const link = path.join(dir, "scripts-link");
  symlinkSync(__dirname, link);

  for (const script of SCRIPTS) {
    it(`${script} behaves the same through a symlinked path and prints something`, () => {
      const dirs = [link, realpathSync(__dirname), __dirname];
      const direct = run(path.join(__dirname, script), dirs);
      const viaLink = run(path.join(link, script), dirs);
      expect(direct.out.length, `${script} printed nothing when run directly`).toBeGreaterThan(0);
      expect(viaLink).toEqual(direct);
    });
  }

  it("cleans up", () => {
    rmSync(dir, { recursive: true, force: true });
  });
});
