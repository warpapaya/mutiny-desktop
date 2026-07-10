import { describe, expect, it, vi } from "vitest";

import {
  ProtocolUrlQueue,
  LINUX_AUTOSTART_ARG,
  applyFirstLaunchAutostart,
  disableWindowsAutoLaunch,
  enableWindowsAutoLaunch,
  extractProtocolUrls,
  isLoginItemLaunch,
  linuxAutoLaunchOptions,
  reconcileWindowsAutoLaunch,
  shouldRestoreMaximised,
  shouldStartMinimised,
  windowsAutoLaunchSettings,
} from "../src/native/startup";

describe("startup settings", () => {
  it("migrates the legacy first-launch flag without enabling autostart", () => {
    const state = { firstLaunch: true };
    applyFirstLaunchAutostart(state);
    expect(state.firstLaunch).toBe(false);
  });

  it("leaves an already-migrated preference untouched", () => {
    const state = { firstLaunch: false };
    applyFirstLaunchAutostart(state);
    expect(state.firstLaunch).toBe(false);
  });

  it("uses supported platform signals for login-item launches", () => {
    expect(isLoginItemLaunch("win32", ["Mutiny.exe", "--mutiny-autostart"], false)).toBe(true);
    expect(isLoginItemLaunch("win32", ["Mutiny.exe"], true)).toBe(false);
    expect(isLoginItemLaunch("darwin", ["Mutiny"], true)).toBe(true);
    expect(isLoginItemLaunch("linux", ["mutiny", LINUX_AUTOSTART_ARG], false)).toBe(true);
    expect(isLoginItemLaunch("linux", ["mutiny"], true)).toBe(false);
  });

  it("configures Linux autostart to include its identifiable login argument", () => {
    expect(linuxAutoLaunchOptions()).toEqual({ name: "Mutiny", isHidden: true });
  });

  it("registers Windows autostart through Squirrel's stable Update.exe", async () => {
    const execPath = String.raw`C:\Users\test\AppData\Local\Mutiny\app-1.2.2\mutiny-desktop.exe`;
    const setLoginItemSettings = vi.fn();
    const legacy = { isEnabled: vi.fn(), enable: vi.fn(), disable: vi.fn() };

    await enableWindowsAutoLaunch({ setLoginItemSettings }, legacy, execPath);

    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      path: String.raw`C:\Users\test\AppData\Local\Mutiny\Update.exe`,
      args: [
        "--processStart",
        '"mutiny-desktop.exe"',
        "--process-start-args",
        '"--mutiny-autostart"',
      ],
    });
    expect(legacy.disable).toHaveBeenCalledOnce();
  });

  it("reconciles an enabled legacy Windows entry into the stable Squirrel entry", async () => {
    const execPath = String.raw`C:\Users\test\AppData\Local\Mutiny\app-1.2.2\mutiny-desktop.exe`;
    const stableSettings = windowsAutoLaunchSettings(execPath, true);
    const app = {
      getLoginItemSettings: vi.fn().mockReturnValue({ openAtLogin: false }),
      setLoginItemSettings: vi.fn(),
    };
    const legacy = {
      isEnabled: vi.fn().mockResolvedValue(true),
      enable: vi.fn(),
      disable: vi.fn().mockResolvedValue(undefined),
    };

    await expect(reconcileWindowsAutoLaunch(app, legacy, execPath)).resolves.toBe(true);
    expect(legacy.disable).toHaveBeenCalledOnce();
    expect(app.setLoginItemSettings).toHaveBeenCalledWith(stableSettings);
  });

  it("disables both stable and legacy Windows autostart entries", async () => {
    const execPath = String.raw`C:\Users\test\AppData\Local\Mutiny\app-1.2.2\mutiny-desktop.exe`;
    const app = { setLoginItemSettings: vi.fn() };
    const legacy = { isEnabled: vi.fn(), enable: vi.fn(), disable: vi.fn() };

    await disableWindowsAutoLaunch(app, legacy, execPath);

    expect(app.setLoginItemSettings).toHaveBeenCalledWith(
      windowsAutoLaunchSettings(execPath, false),
    );
    expect(legacy.disable).toHaveBeenCalledOnce();
  });

  it("starts hidden only for a login-item launch with the setting enabled", () => {
    expect(shouldStartMinimised(true, true)).toBe(true);
    expect(shouldStartMinimised(true, false)).toBe(false);
    expect(shouldStartMinimised(false, true)).toBe(false);
  });

  it("does not reveal a hidden login launch while restoring window state", () => {
    expect(shouldRestoreMaximised(true, true)).toBe(false);
    expect(shouldRestoreMaximised(true, false)).toBe(true);
  });
});

describe("protocol URLs", () => {
  it("extracts only valid mutiny URLs from argv", () => {
    expect(
      extractProtocolUrls(["Mutiny", "--flag", "mutiny://invite/abc", "https://example.com"]),
    ).toEqual(["mutiny://invite/abc"]);
  });

  it("queues cold-launch URLs and flushes once the renderer is ready", () => {
    const send = vi.fn();
    const queue = new ProtocolUrlQueue();
    queue.enqueue("mutiny://invite/cold");
    expect(send).not.toHaveBeenCalled();

    queue.rendererReady({ webContents: { send } });
    expect(send).toHaveBeenCalledWith("protocol-url", "mutiny://invite/cold");
  });

  it("delivers already-running URLs immediately after renderer readiness", () => {
    const send = vi.fn();
    const queue = new ProtocolUrlQueue();
    queue.rendererReady({ webContents: { send } });
    queue.enqueue("mutiny://channel/running");
    expect(send).toHaveBeenCalledWith("protocol-url", "mutiny://channel/running");
  });
});
