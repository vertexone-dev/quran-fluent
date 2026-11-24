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
import type { Plugin } from "vite";
import { CSP } from "./csp";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

/**
 * Adds the Content-Security-Policy to the BUILT index.html only. The dev server injects
 * inline scripts for hot reload, which a strict policy would block, so `npm run dev` is
 * unchanged. Every production, Capacitor and preview build carries the policy.
 */
function cspMeta(): Plugin {
  return {
    name: "qr-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), cspMeta()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
