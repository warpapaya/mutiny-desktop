export interface PickerResultController {
  select(sourceId: string): void;
  cancel(): void;
  closed(): void;
}

export const PICKER_SELECT_CHANNEL = "screen-picker:select";
export const PICKER_CANCEL_CHANNEL = "screen-picker:cancel";
export const PICKER_READY_CHANNEL = "screen-picker:ready";

interface EventTarget {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(event: string, listener: (...args: unknown[]) => void): unknown;
}

interface PickerWindow extends EventTarget {
  webContents: EventTarget;
  close(): void;
}

type PickerIpc = EventTarget;

function senderFrom(event: unknown): object | undefined {
  if (typeof event !== "object" || event === null || !("sender" in event)) {
    return undefined;
  }
  const sender = (event as { sender: unknown }).sender;
  return (typeof sender === "object" && sender !== null) ||
    typeof sender === "function"
    ? sender
    : undefined;
}

export function registerPickerIpc(
  ipc: PickerIpc,
  expectedSender: object,
  controller: PickerResultController,
): () => void {
  const onSelect = (event: unknown, sourceId: unknown) => {
    if (senderFrom(event) === expectedSender && typeof sourceId === "string") {
      controller.select(sourceId);
    }
  };
  const onCancel = (event: unknown) => {
    if (senderFrom(event) === expectedSender) controller.cancel();
  };

  ipc.on(PICKER_SELECT_CHANNEL, onSelect);
  ipc.on(PICKER_CANCEL_CHANNEL, onCancel);

  return () => {
    ipc.removeListener(PICKER_SELECT_CHANNEL, onSelect);
    ipc.removeListener(PICKER_CANCEL_CHANNEL, onCancel);
  };
}

export function createPickerResultController(
  sources: Electron.DesktopCapturerSource[],
  resolve: (source: Electron.DesktopCapturerSource | null) => void,
  close: () => void,
  cleanup: () => void = () => undefined,
): PickerResultController {
  let completed = false;

  const complete = (
    source: Electron.DesktopCapturerSource | null,
    shouldClose: boolean,
  ) => {
    if (completed) return;
    completed = true;
    cleanup();
    if (shouldClose) close();
    resolve(source);
  };

  return {
    select(sourceId) {
      complete(sources.find((source) => source.id === sourceId) ?? null, true);
    },
    cancel() {
      complete(null, true);
    },
    closed() {
      complete(null, false);
    },
  };
}

/**
 * Own every listener and readiness timer for one picker window. Completion
 * removes them before closing so synchronous close events cannot resolve twice.
 */
export function registerPickerSession(
  ipc: PickerIpc,
  picker: PickerWindow,
  sources: Electron.DesktopCapturerSource[],
  resolve: (source: Electron.DesktopCapturerSource | null) => void,
  readinessTimeoutMs = 5_000,
): void {
  let cleanupAll: () => void = () => void 0;
  const controller = createPickerResultController(
    sources,
    resolve,
    () => picker.close(),
    () => cleanupAll(),
  );
  const unregisterIpc = registerPickerIpc(
    ipc,
    picker.webContents,
    controller,
  );

  const onClosed = () => controller.closed();
  const onRenderProcessGone = () => controller.cancel();
  let readinessTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
    () => controller.cancel(),
    readinessTimeoutMs,
  );
  const onReady = (event: unknown) => {
    if (senderFrom(event) !== picker.webContents) return;
    cleanupReadiness();
  };
  const cleanupReadiness = () => {
    if (readinessTimer !== undefined) {
      clearTimeout(readinessTimer);
      readinessTimer = undefined;
    }
    ipc.removeListener(PICKER_READY_CHANNEL, onReady);
  };

  picker.on("closed", onClosed);
  picker.webContents.on("render-process-gone", onRenderProcessGone);
  ipc.on(PICKER_READY_CHANNEL, onReady);

  let cleaned = false;
  cleanupAll = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupReadiness();
    unregisterIpc();
    picker.removeListener("closed", onClosed);
    picker.webContents.removeListener("render-process-gone", onRenderProcessGone);
  };
}
