type IpcLike = {
  on(
    channel: string,
    listener: (_event: unknown, count: number) => void,
  ): unknown;
};

const registered = new WeakSet<object>();

export function registerBadgeHandler(
  ipc: IpcLike,
  setBadge: (count: number) => Promise<void> | void,
): void {
  if (registered.has(ipc as object)) return;
  registered.add(ipc as object);
  ipc.on("setBadgeCount", (_event, count) => {
    void setBadge(count);
  });
}
