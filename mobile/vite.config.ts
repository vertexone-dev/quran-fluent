// Standalone Vite config for the Phase 0 mobile feasibility prototype.
// Deliberately NOT @lovable.dev/vite-tanstack-config, NOT TanStack Start,
// NOT the Cloudflare/Nitro preset -- this produces a plain static SPA
// build (HTML + JS + CSS, no server), which is what a Capacitor webDir
// needs. The existing root vite.config.ts and its production build are
// completely untouched.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
