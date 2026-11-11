// QR-WEB-006: dev-server-only override read by artwork.ts (ignored in any build).
interface ImportMetaEnv {
  readonly VITE_ART_MODE?: string;
}
