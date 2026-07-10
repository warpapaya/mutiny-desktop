import AutoLaunch from "auto-launch";
import { app, ipcMain } from "electron";

import { WINDOWS_AUTOSTART_ARG, linuxAutoLaunchOptions } from "./startup";

const linuxAutoLaunch = new AutoLaunch(linuxAutoLaunchOptions());

export const autoLaunch = {
  async isEnabled(): Promise<boolean> {
    if (process.platform === "linux") return linuxAutoLaunch.isEnabled();
    return app.getLoginItemSettings().openAtLogin;
  },

  async enable(): Promise<void> {
    if (process.platform === "linux") return linuxAutoLaunch.enable();
    app.setLoginItemSettings({
      openAtLogin: true,
      args: process.platform === "win32" ? [WINDOWS_AUTOSTART_ARG] : [],
    });
  },

  async disable(): Promise<void> {
    if (process.platform === "linux") return linuxAutoLaunch.disable();
    app.setLoginItemSettings({
      openAtLogin: false,
      args: process.platform === "win32" ? [WINDOWS_AUTOSTART_ARG] : [],
    });
  },
};

ipcMain.handle("autostart:get", async (): Promise<boolean> => autoLaunch.isEnabled());
ipcMain.handle("autostart:set", async (_event, state: boolean): Promise<boolean> => {
  if (state) {
    await autoLaunch.enable();
  } else {
    await autoLaunch.disable();
  }
  return autoLaunch.isEnabled();
});
