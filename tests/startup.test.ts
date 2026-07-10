import { describe, expect, it, vi } from "vitest";

import {
  ProtocolUrlQueue,
  applyFirstLaunchAutostart,
  extractProtocolUrls,
  isLoginItemLaunch,
  shouldRestoreMaximised,
  shouldStartMinimised,
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
    expect(isLoginItemLaunch("linux", ["mutiny", "--mutiny-autostart"], true)).toBe(false);
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
