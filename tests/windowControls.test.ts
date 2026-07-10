import { describe, expect, it, vi } from "vitest";

import { registerWindowControlHandlers } from "../src/native/windowControls";

class FakeIpc {
  listeners = new Map<string, Array<() => void>>();
  on(name: string, listener: () => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  emit(name: string) {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
}

describe("window control IPC", () => {
  it("registers one listener per command across window recreation", () => {
    const ipc = new FakeIpc();
    let current = {
      minimize: vi.fn(), close: vi.fn(), maximize: vi.fn(), unmaximize: vi.fn(), isMaximized: vi.fn(() => false), isDestroyed: vi.fn(() => false),
    };

    registerWindowControlHandlers(ipc, () => current);
    registerWindowControlHandlers(ipc, () => current);
    expect(ipc.listeners.get("maximise")).toHaveLength(1);

    ipc.emit("maximise");
    expect(current.maximize).toHaveBeenCalledOnce();

    current = { ...current, maximize: vi.fn(), isMaximized: vi.fn(() => true) };
    ipc.emit("maximise");
    expect(current.unmaximize).toHaveBeenCalledOnce();
  });
});
