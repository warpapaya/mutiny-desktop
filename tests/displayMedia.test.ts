import { describe, expect, it, vi } from "vitest";

import {
  SCREEN_PERMISSION_SETTINGS_URL,
  createDisplayMediaRequestHandler,
  displayMediaHandlerOptions,
  screenPermissionGuidance,
} from "../src/native/displayMedia";

const source = { id: "screen:1:0", name: "Primary Display" } as Electron.DesktopCapturerSource;

describe("display media request handling", () => {
  it("uses the native system picker only on macOS", () => {
    expect(displayMediaHandlerOptions("darwin")).toEqual({ useSystemPicker: true });
    expect(displayMediaHandlerOptions("win32")).toEqual({ useSystemPicker: false });
    expect(displayMediaHandlerOptions("linux")).toEqual({ useSystemPicker: false });
  });

  it("provides explicit steps and a recoverable System Settings action", () => {
    const guidance = screenPermissionGuidance("denied");

    expect(guidance.message).toContain("Screen Recording");
    expect(guidance.detail).toContain("System Settings");
    expect(guidance.detail).toContain("restart Mutiny");
    expect(guidance.buttons).toEqual(["Open System Settings", "Cancel"]);
    expect(SCREEN_PERMISSION_SETTINGS_URL).toContain("Privacy_ScreenCapture");
  });

  it("directs restricted users to an administrator without a misleading Settings action", () => {
    const guidance = screenPermissionGuidance("restricted");

    expect(guidance.detail).toContain("administrator");
    expect(guidance.detail).not.toContain("System Settings");
    expect(guidance.buttons).toEqual(["OK"]);
  });

  it.each(["denied", "restricted"] as const)(
    "returns recoverable guidance without capturing when screen access is %s",
    async (status) => {
      const pickSource = vi.fn();
      const showPermissionGuidance = vi.fn().mockResolvedValue(undefined);
      const callback = vi.fn();
      const handler = createDisplayMediaRequestHandler({
        platform: "darwin",
        getScreenAccessStatus: () => status,
        pickSource,
        showPermissionGuidance,
      });

      await handler({} as Electron.DisplayMediaRequestHandlerHandlerRequest, callback);

      expect(showPermissionGuidance).toHaveBeenCalledWith(status);
      expect(pickSource).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith({});
    },
  );

  it("returns the selected source exactly once", async () => {
    const callback = vi.fn();
    const handler = createDisplayMediaRequestHandler({
      platform: "linux",
      getScreenAccessStatus: () => "unknown",
      pickSource: vi.fn().mockResolvedValue(source),
      showPermissionGuidance: vi.fn(),
    });

    await handler({} as Electron.DisplayMediaRequestHandlerHandlerRequest, callback);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({ video: source });
  });

  it("resolves cancellation exactly once", async () => {
    const callback = vi.fn();
    const handler = createDisplayMediaRequestHandler({
      platform: "win32",
      getScreenAccessStatus: () => "unknown",
      pickSource: vi.fn().mockResolvedValue(null),
      showPermissionGuidance: vi.fn(),
    });

    await handler({} as Electron.DisplayMediaRequestHandlerHandlerRequest, callback);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({});
  });

  it("resolves picker errors exactly once", async () => {
    const callback = vi.fn();
    const reportError = vi.fn();
    const error = new Error("picker failed");
    const handler = createDisplayMediaRequestHandler({
      platform: "linux",
      getScreenAccessStatus: () => "unknown",
      pickSource: vi.fn().mockRejectedValue(error),
      showPermissionGuidance: vi.fn(),
      reportError,
    });

    await handler({} as Electron.DisplayMediaRequestHandlerHandlerRequest, callback);

    expect(reportError).toHaveBeenCalledWith(error);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith({});
  });
});
