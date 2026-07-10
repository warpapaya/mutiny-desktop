import { describe, expect, it, vi } from "vitest";

import { registerBadgeHandler } from "../src/native/badgesRegistration";

class FakeIpc {
  listeners = new Map<string, Array<(_event: unknown, count: number) => void>>();
  on(name: string, listener: (_event: unknown, count: number) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
}

describe("badge IPC", () => {
  it("loads exactly one handler that forwards nonzero and clear counts", async () => {
    const ipc = new FakeIpc();
    const setBadge = vi.fn().mockResolvedValue(undefined);
    registerBadgeHandler(ipc, setBadge);
    registerBadgeHandler(ipc, setBadge);
    expect(ipc.listeners.get("setBadgeCount")).toHaveLength(1);

    const [listener] = ipc.listeners.get("setBadgeCount") ?? [];
    expect(listener).toBeDefined();
    if (!listener) throw new Error("badge listener was not registered");
    listener(undefined, 3);
    listener(undefined, 0);
    await Promise.resolve();
    expect(setBadge).toHaveBeenNthCalledWith(1, 3);
    expect(setBadge).toHaveBeenNthCalledWith(2, 0);
  });
});
