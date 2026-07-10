import AutoLaunch from "auto-launch";
import { app, ipcMain } from "electron";

import {
  disableWindowsAutoLaunch,
  enableWindowsAutoLaunch,
  linuxAutoLaunchOptions,
  reconcileWindowsAutoLaunch,
} from "./startup";

const linuxAutoLaunch = new AutoLaunch(linuxAutoLaunchOptions());
const legacyWindowsAutoLaunch = new AutoLaunch({ name: "Mutiny" });

export const autoLaunch = {
  async isEnabled(): Promise<boolean> {
    if (process.platform === "linux") return linuxAutoLaunch.isEnabled();
    if (process.platform === "win32") {
      return reconcileWindowsAutoLaunch(app, legacyWindowsAutoLaunch, process.execPath);
    }
    return app.getLoginItemSettings().openAtLogin;
  },

  async enable(): Promise<void> {
    if (process.platform === "linux") return linuxAutoLaunch.enable();
    if (process.platform === "win32") {
      return enableWindowsAutoLaunch(app, legacyWindowsAutoLaunch, process.execPath);
    }
    app.setLoginItemSettings({ openAtLogin: true });
  },

  async disable(): Promise<void> {
    if (process.platform === "linux") return linuxAutoLaunch.disable();
    if (process.platform === "win32") {
      return disableWindowsAutoLaunch(app, legacyWindowsAutoLaunch, process.execPath);
    }
    app.setLoginItemSettings({ openAtLogin: false });
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
