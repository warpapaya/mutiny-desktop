type WindowLike = {
  isDestroyed(): boolean;
  minimize(): void;
  close(): void;
  isMaximized(): boolean;
  maximize(): void;
  unmaximize(): void;
};

type IpcLike = { on(channel: string, listener: () => void): unknown };

const registered = new WeakSet<object>();

export function registerWindowControlHandlers(
  ipc: IpcLike,
  getWindow: () => WindowLike | undefined,
): void {
  if (registered.has(ipc as object)) return;
  registered.add(ipc as object);

  const withWindow = (action: (window: WindowLike) => void) => () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) action(window);
  };

  ipc.on("minimise", withWindow((window) => window.minimize()));
  ipc.on("maximise", withWindow((window) =>
    window.isMaximized() ? window.unmaximize() : window.maximize(),
  ));
  ipc.on("close", withWindow((window) => window.close()));
}
