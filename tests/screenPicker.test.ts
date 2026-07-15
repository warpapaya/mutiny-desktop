import { describe, expect, it, vi } from "vitest";

import {
  PICKER_CANCEL_CHANNEL,
  PICKER_SELECT_CHANNEL,
  createPickerResultController,
  registerPickerIpc,
} from "../src/native/screenPickerResult";

const source = { id: "window:1:0", name: "Browser" } as Electron.DesktopCapturerSource;

describe("fallback screen picker result controller", () => {
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
