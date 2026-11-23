// Standalone Vite config for the Phase 0 mobile feasibility prototype.
// Deliberately NOT @lovable.dev/vite-tanstack-config, NOT TanStack Start,
// NOT the Cloudflare/Nitro preset -- this produces a plain static SPA
// build (HTML + JS + CSS, no server), which is what a Capacitor webDir
// needs. The existing root vite.config.ts and its production build are
// completely untouched.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
