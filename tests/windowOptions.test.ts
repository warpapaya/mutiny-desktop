import { describe, expect, it } from "vitest";

import {
  mainWindowOptions,
  usesCustomFrame,
} from "../src/native/windowOptions";

describe("main window options", () => {
  it("reports the configured custom titlebar on every supported desktop platform", () => {
    expect(usesCustomFrame("darwin", true)).toBe(true);
    expect(usesCustomFrame("darwin", false)).toBe(false);
    expect(usesCustomFrame("win32", true)).toBe(true);
    expect(usesCustomFrame("linux", true)).toBe(true);
    expect(usesCustomFrame("linux", false)).toBe(false);
  });

  it("uses native hidden-inset chrome and traffic lights on macOS", () => {
    expect(mainWindowOptions("darwin", true)).toMatchObject({
      frame: true,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
      minWidth: 800,
      minHeight: 600,
    });
  });

  it.each(["win32", "linux"] as const)(
    "preserves the 300 by 300 minimum and configured custom frame on %s",
    (platform) => {
      expect(mainWindowOptions(platform, true)).toMatchObject({
        frame: false,
        minWidth: 300,
        minHeight: 300,
      });
      expect(mainWindowOptions(platform, false)).toMatchObject({ frame: true });
      expect(mainWindowOptions(platform, true)).not.toHaveProperty("titleBarStyle");
      expect(mainWindowOptions(platform, true)).not.toHaveProperty("trafficLightPosition");
    },
  );
});
