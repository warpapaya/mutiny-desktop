export interface PickerResultController {
  select(sourceId: string): void;
  cancel(): void;
  closed(): void;
}

export const PICKER_SELECT_CHANNEL = "screen-picker:select";
export const PICKER_CANCEL_CHANNEL = "screen-picker:cancel";

type PickerIpc = Pick<Electron.IpcMain, "on" | "removeListener">;

export function registerPickerIpc(
  ipc: PickerIpc,
  expectedSender: object,
  controller: PickerResultController,
): () => void {
  const onSelect = (event: { sender: object }, sourceId: string) => {
    if (event.sender === expectedSender && typeof sourceId === "string") {
      controller.select(sourceId);
    }
  };
  const onCancel = (event: { sender: object }) => {
    if (event.sender === expectedSender) controller.cancel();
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
): PickerResultController {
  let completed = false;

  const complete = (
    source: Electron.DesktopCapturerSource | null,
    shouldClose: boolean,
  ) => {
    if (completed) return;
    completed = true;
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
