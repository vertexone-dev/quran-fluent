// Deliberately separate from vite.config.ts, which wraps a managed preset
// (@lovable.dev/vite-tanstack-config) that warns against adding plugins
// manually. Unit tests only need the `@` path alias, nothing else from
// that preset (no TanStack Start, no SSR, no Cloudflare/nitro target).
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // scripts/lib/**/*.test.ts added in Phase 8C.3 so the pure content-
    // source-governance/hash functions in
    // scripts/lib/content-source-governance.mjs (imported by
    // scripts/validate-quran-content.mjs, a plain Node ESM script -- not
    // part of the Vite-bundled app) are directly unit-testable via the same
    // `npm run test:unit` / CI gate as everything under src/. Scoped to
    // scripts/lib/ specifically (not a broad scripts/**) -- a wider glob
    // picks up scripts/quran-import/kazimirski/local-prototype/tests/
    // resolver.test.ts, a pre-existing, never-previously-run local-prototype
    // test file with 5 failing tests against stale fixture data, unrelated
    // to this change; confirmed during authoring that including it would
    // turn `npm run test:unit` red.
    include: ["src/**/*.test.ts", "scripts/lib/**/*.test.ts"],
  },
});
