import { describe, expect, it, vi } from "vitest";

import {
  PICKER_CANCEL_CHANNEL,
  PICKER_READY_CHANNEL,
  PICKER_SELECT_CHANNEL,
  createPickerResultController,
  registerPickerIpc,
  registerPickerSession,
} from "../src/native/screenPickerResult";

const source = { id: "window:1:0", name: "Browser" } as Electron.DesktopCapturerSource;

describe("fallback screen picker result controller", () => {
  function emitter() {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    return {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(listener);
        listeners.set(event, eventListeners);
      }),
      removeListener: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.get(event)?.delete(listener);
      }),
      emit(event: string, ...args: unknown[]) {
        for (const listener of [...(listeners.get(event) ?? [])]) listener(...args);
      },
      listenerCount(event: string) {
        return listeners.get(event)?.size ?? 0;
      },
    };
  }

  function pickerSession() {
    const ipc = emitter();
    const webContents = emitter();
    const windowEvents = emitter();
    const picker = {
      ...windowEvents,
      webContents,
      close: vi.fn(),
    };
    const resolve = vi.fn();
    registerPickerSession(ipc, picker, [source], resolve, 1_000);
    return { ipc, webContents, picker, resolve };
  }

  it("cancels exactly once and removes every listener when the renderer exits", () => {
    const { ipc, webContents, picker, resolve } = pickerSession();

    webContents.emit("render-process-gone", {}, { reason: "crashed" });
    webContents.emit("render-process-gone", {}, { reason: "crashed" });
    ipc.emit(PICKER_CANCEL_CHANNEL, { sender: webContents });

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(null);
    expect(picker.close).toHaveBeenCalledOnce();
    expect(picker.listenerCount("closed")).toBe(0);
    expect(webContents.listenerCount("render-process-gone")).toBe(0);
    expect(ipc.listenerCount(PICKER_SELECT_CHANNEL)).toBe(0);
    expect(ipc.listenerCount(PICKER_CANCEL_CHANNEL)).toBe(0);
    expect(ipc.listenerCount(PICKER_READY_CHANNEL)).toBe(0);
  });

  it("fails closed after a bounded wait when the picker preload never becomes ready", () => {
    vi.useFakeTimers();
    const { ipc, webContents, picker, resolve } = pickerSession();

    vi.advanceTimersByTime(1_000);

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(null);
    expect(picker.close).toHaveBeenCalledOnce();
    expect(ipc.listenerCount(PICKER_READY_CHANNEL)).toBe(0);
    expect(webContents.listenerCount("render-process-gone")).toBe(0);
    vi.useRealTimers();
  });

  it("keeps the picker alive after a validated preload readiness handshake", () => {
    vi.useFakeTimers();
    const { ipc, webContents, picker, resolve } = pickerSession();

    ipc.emit(PICKER_READY_CHANNEL, { sender: {} });
    ipc.emit(PICKER_READY_CHANNEL, { sender: webContents });
    vi.advanceTimersByTime(1_000);

    expect(resolve).not.toHaveBeenCalled();
    expect(ipc.listenerCount(PICKER_READY_CHANNEL)).toBe(0);

    ipc.emit(PICKER_CANCEL_CHANNEL, { sender: webContents });
    expect(resolve).toHaveBeenCalledOnce();
    expect(picker.close).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("accepts a valid selection and ignores later close and cancel signals", () => {
    const resolve = vi.fn();
    const close = vi.fn();
    const controller = createPickerResultController([source], resolve, close);

    controller.select(source.id);
    controller.cancel();
    controller.closed();

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(source);
    expect(close).toHaveBeenCalledOnce();
  });

  it("treats an unknown source id as a safe cancellation", () => {
    const resolve = vi.fn();
    const close = vi.fn();
    const controller = createPickerResultController([source], resolve, close);

    controller.select("window:not-offered");
    controller.closed();

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(null);
    expect(close).toHaveBeenCalledOnce();
  });

  it("accepts picker IPC only from the picker web contents and cleans listeners up", () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const ipc = {
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    ipc.on.mockImplementation(
      (channel: string, listener: (...args: unknown[]) => void) => {
        listeners.set(channel, listener);
        return ipc;
      },
    );
    ipc.removeListener.mockImplementation((channel: string) => {
      listeners.delete(channel);
      return ipc;
    });
    const pickerSender = {};
    const controller = { select: vi.fn(), cancel: vi.fn(), closed: vi.fn() };
    const unregister = registerPickerIpc(ipc, pickerSender, controller);

    listeners.get(PICKER_SELECT_CHANNEL)?.({ sender: {} }, source.id);
    listeners.get(PICKER_CANCEL_CHANNEL)?.({ sender: pickerSender });

    expect(controller.select).not.toHaveBeenCalled();
    expect(controller.cancel).toHaveBeenCalledOnce();

    unregister();
    expect(ipc.removeListener).toHaveBeenCalledTimes(2);
  });

  it("resolves a window-close cancellation exactly once", () => {
    const resolve = vi.fn();
    const controller = createPickerResultController([source], resolve, vi.fn());

    controller.closed();
    controller.closed();

    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(null);
  });
});
