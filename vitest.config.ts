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
    include: ["src/**/*.test.ts"],
  },
});
