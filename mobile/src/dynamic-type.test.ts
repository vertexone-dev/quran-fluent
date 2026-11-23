import { describe, expect, it } from "vitest";
import {
  DEFAULT_BODY_PX,
  MAX_SCALE,
  MIN_SCALE,
  scaleFromBodyPx,
  zoomFromProbePx,
} from "./dynamic-type";

describe("scaleFromBodyPx", () => {
  it("is exactly 1 at iOS's default Large size", () => {
    expect(scaleFromBodyPx(DEFAULT_BODY_PX)).toBe(1);
  });

  it("maps the iOS body sizes to proportional factors", () => {
    // xSmall 14, Small 15, Medium 16, Large 17, xL 19, xxL 21, xxxL 23,
    // AX1 28, AX2 33, AX3 40, AX4 47, AX5 53
    expect(scaleFromBodyPx(14)).toBe(0.82);
    expect(scaleFromBodyPx(19)).toBe(1.12);
    expect(scaleFromBodyPx(23)).toBe(1.35);
    expect(scaleFromBodyPx(40)).toBe(2.35);
    expect(scaleFromBodyPx(53)).toBe(3.12);
  });

  it("clamps absurd values and falls back to 1 for unusable input", () => {
    expect(scaleFromBodyPx(1)).toBe(MIN_SCALE);
    expect(scaleFromBodyPx(500)).toBe(MAX_SCALE);
    for (const bad of [0, -3, NaN, Infinity]) expect(scaleFromBodyPx(bad)).toBe(1);
  });
});

describe("zoomFromProbePx (Android font scale as seen by the page)", () => {
  it("is 1 when the WebView applies no zoom", () => {
    expect(zoomFromProbePx(16)).toBe(1);
  });

  it("recovers the Android font scales measured on a device (QR-DESIGN-007C)", () => {
    expect(zoomFromProbePx(20.8)).toBe(1.3);
    expect(zoomFromProbePx(24)).toBe(1.5);
    expect(zoomFromProbePx(32)).toBe(2);
  });

  it("clamps and falls back to 1 for unusable input", () => {
    expect(zoomFromProbePx(1)).toBe(MIN_SCALE);
    expect(zoomFromProbePx(500)).toBe(MAX_SCALE);
    for (const bad of [0, -3, NaN, Infinity]) expect(zoomFromProbePx(bad)).toBe(1);
  });
});
