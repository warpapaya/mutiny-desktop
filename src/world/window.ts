import { contextBridge, ipcRenderer } from "electron";

import { version } from "../../package.json";

ipcRenderer.on("protocol-url", (_event, url: string) => {
  window.dispatchEvent(
    new CustomEvent("mutiny-protocol-url", { detail: url }),
  );
});

contextBridge.exposeInMainWorld("native", {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    desktop: () => version,
  },

  isDesktop: true,
  platform: process.platform,

  minimise: () => ipcRenderer.send("minimise"),
  maximise: () => ipcRenderer.send("maximise"),
  close: () => ipcRenderer.send("close"),

  setBadgeCount: (count: number) => ipcRenderer.send("setBadgeCount", count),

  onProtocolUrl: (callback: (url: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on("protocol-url", listener);
    return () => ipcRenderer.removeListener("protocol-url", listener);
  },

  openAudioFile: () => ipcRenderer.invoke("dialog:openAudioFile"),
});
