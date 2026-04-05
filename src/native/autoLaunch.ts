import AutoLaunch from "auto-launch";

import { ipcMain } from "electron";

import { BRAND } from "./branding";
import { mainWindow } from "./window";

export const autoLaunch = new AutoLaunch({
  name: BRAND.productName,
});

ipcMain.on("isAutostart?", () =>
  autoLaunch
    .isEnabled()
    .then((enabled) => mainWindow.webContents.send("isAutostart", enabled)),
);

ipcMain.on("setAutostart", (_event, state: boolean) => {
  if (state) {
    autoLaunch.enable();
  } else {
    autoLaunch.disable();
  }
});
