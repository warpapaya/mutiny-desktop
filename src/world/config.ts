import { contextBridge, ipcRenderer } from "electron";

let config: DesktopConfig;

ipcRenderer.on("config", (_, data: DesktopConfig) => (config = data));

contextBridge.exposeInMainWorld("desktopConfig", {
  get: () => config,
  set: (newConfig: Partial<DesktopConfig>) => ipcRenderer.send("config", newConfig),
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke("autostart:get"),
  setAutostart: (value: boolean): Promise<boolean> =>
    ipcRenderer.invoke("autostart:set", value),
});
