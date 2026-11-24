/**
 * iOS Dynamic Type support (QR-DESIGN-006).
 *
 * WKWebView does not scale web text with the system text size unless the page
 * opts in through a system font keyword. We measure what `font: -apple-system-body`
 * resolves to (17px at the default "Large" size, bigger or smaller at other sizes)
 * and publish the ratio as `--qr-system-text-scale` on <html>. The stylesheet
 * multiplies it into the ROOT font size only:
 *
 *   html { font-size: calc(<in-app Text Size %> * var(--qr-system-text-scale, 1)) }
 *
 * so the in-app Text Size (small / medium / large) and the system size combine
 * exactly once, by multiplication, and every rem-based size follows. Nothing else
 * reads the variable, which is how double-scaling is avoided.
 *
 * Where the keyword is unsupported (Android, desktop browsers) the factor is 1
 * and nothing changes.
 *
 * Android (QR-DESIGN-007C): the WebView already scales text with the system font
 * scale, and `getComputedStyle().fontSize` reports the zoomed size (a `16px`
 * probe reads 20.8px at 1.3x, 32px at 2.0x). We publish that as `--qr-text-zoom`.
 * It is NOT multiplied into the root size (the WebView already did that); it is
 * only used to cap "chrome" (tab labels, headers) at 1.3x, exactly as on iOS, so
 * five tab labels fit at font scale 2.0. WKWebView does not zoom, so the probe
 * reads 1 there and iOS is unchanged.
 */

/** Body text size at iOS's default content size ("Large"), in CSS px. */
export const DEFAULT_BODY_PX = 17;
/** Smallest / largest factor we apply (xSmall is 14/17; AX5 is 53/17 = 3.12). */
export const MIN_SCALE = 0.8;
export const MAX_SCALE = 3.2;

/** Pure: convert the measured body font size to a clamped, rounded factor. */
export function scaleFromBodyPx(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 1;
  const raw = px / DEFAULT_BODY_PX;
  return Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw)) * 100) / 100;
}

/** Measures the current system text scale; 1 when Dynamic Type is not available. */
export function measureSystemTextScale(doc: Document = document): number {
  const win = doc.defaultView;
  if (!win || !win.CSS || !win.CSS.supports("font", "-apple-system-body")) return 1;
  const probe = doc.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;font:-apple-system-body";
  probe.textContent = "M";
  doc.body.appendChild(probe);
  const px = parseFloat(win.getComputedStyle(probe).fontSize);
  probe.remove();
  return scaleFromBodyPx(px);
}

/** Pure: convert a `font-size: 16px` probe's computed size into the zoom factor. */
export function zoomFromProbePx(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 1;
  return Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, px / 16)) * 100) / 100;
}

/** Measures the text zoom the WebView itself applies (Android font scale); 1 when none. */
export function measureTextZoom(doc: Document = document): number {
  const win = doc.defaultView;
  if (!win) return 1;
  const probe = doc.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;white-space:nowrap;font:16px sans-serif";
  probe.textContent = "M";
  doc.body.appendChild(probe);
  const px = parseFloat(win.getComputedStyle(probe).fontSize);
  probe.remove();
  return zoomFromProbePx(px);
}

/**
 * Applies the factor now and again whenever the app returns to the foreground or
 * the viewport changes (the user can change the text size in Control Center or
 * Settings while the app is in the background). Returns an uninstall function.
 */
export function installDynamicType(doc: Document = document): () => void {
  const win = doc.defaultView;
  const root = doc.documentElement;
  const apply = () => {
    const scale = measureSystemTextScale(doc);
    root.style.setProperty("--qr-system-text-scale", String(scale));
    root.dataset.systemTextScale = String(scale);
    const zoom = measureTextZoom(doc);
    root.style.setProperty("--qr-text-zoom", String(zoom));
    root.dataset.textZoom = String(zoom);
  };
  apply();
  if (!win) return () => {};
  const onVisible = () => {
    if (doc.visibilityState === "visible") apply();
  };
  win.addEventListener("resize", apply);
  win.addEventListener("focus", apply);
  win.addEventListener("pageshow", apply);
  doc.addEventListener("visibilitychange", onVisible);
  return () => {
    win.removeEventListener("resize", apply);
    win.removeEventListener("focus", apply);
    win.removeEventListener("pageshow", apply);
    doc.removeEventListener("visibilitychange", onVisible);
  };
}
