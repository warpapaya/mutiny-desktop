import { describe, expect, it } from "vitest";

import { badgePlan, normalizeBadgeCacheKey } from "../src/native/badgePolicy";

describe("badge platform policy", () => {
  it("uses Electron's supported application badge on Linux", () => {
    expect(badgePlan("linux", 12)).toEqual({ kind: "app", count: 12 });
    expect(badgePlan("linux", 0)).toEqual({ kind: "app", count: 0 });
  });

  it("reserves window overlay icons for Windows", () => {
    expect(badgePlan("win32", 12)).toEqual({ kind: "overlay", count: 12 });
  });

  it("normalizes visually equivalent counts to bounded icon cache keys", () => {
    expect(normalizeBadgeCacheKey(-1)).toBe(-1);
    expect(normalizeBadgeCacheKey(1)).toBe(1);
    expect(normalizeBadgeCacheKey(10)).toBe(10);
    expect(normalizeBadgeCacheKey(11)).toBe(10);
    expect(normalizeBadgeCacheKey(Number.MAX_SAFE_INTEGER)).toBe(10);
  });
});