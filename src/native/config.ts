import { ipcMain } from "electron";
import Store from "electron-store";

import { configDefaults, configSchema } from "./configSchema";

import { destroyDiscordRpc, initDiscordRpc } from "./discordRpc";
import { mainWindow } from "./window";
import { usesCustomFrame } from "./windowOptions";

const store = new Store({
  schema: configSchema,
  defaults: configDefaults,
});

/**
 * Shim for `electron-store` because typings are broken
 */
class Config {
  sync() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("config", {
      firstLaunch: this.firstLaunch,
      customFrame: usesCustomFrame(process.platform, this.customFrame),
      minimiseToTray: this.minimiseToTray,
      startMinimisedToTray: this.startMinimisedToTray,
      spellchecker: this.spellchecker,
      hardwareAcceleration: this.hardwareAcceleration,
      discordRpc: this.discordRpc,
      windowState: this.windowState,
    });
  }

  get firstLaunch() {
    return (store as never as { get(k: string): boolean }).get("firstLaunch");
  }

  set firstLaunch(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "firstLaunch",
      value,
    );

    this.sync();
  }

  get customFrame() {
    return (store as never as { get(k: string): boolean }).get("customFrame");
  }

  set customFrame(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "customFrame",
      value,
    );

    this.sync();
  }

  get minimiseToTray() {
    return (store as never as { get(k: string): boolean }).get(
      "minimiseToTray",
    );
  }

  set minimiseToTray(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "minimiseToTray",
      value,
    );

    this.sync();
  }

  get startMinimisedToTray() {
    return (store as never as { get(k: string): boolean }).get(
      "startMinimisedToTray",
    );
  }

  set startMinimisedToTray(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "startMinimisedToTray",
      value,
    );
    this.sync();
  }

  get spellchecker() {
    return (store as never as { get(k: string): boolean }).get("spellchecker");
  }

  set spellchecker(value: boolean) {
    mainWindow.webContents.session.setSpellCheckerEnabled(value);

    (store as never as { set(k: string, value: boolean): void }).set(
      "spellchecker",
      value,
    );

    this.sync();
  }

  get hardwareAcceleration() {
    return (store as never as { get(k: string): boolean }).get(
      "hardwareAcceleration",
    );
  }

  set hardwareAcceleration(value: boolean) {
    (store as never as { set(k: string, value: boolean): void }).set(
      "hardwareAcceleration",
      value,
    );

    this.sync();
  }

  get discordRpc() {
    return (store as never as { get(k: string): boolean }).get("discordRpc");
  }

  set discordRpc(value: boolean) {
    if (value) {
      initDiscordRpc();
    } else {
      destroyDiscordRpc();
    }

    (store as never as { set(k: string, value: boolean): void }).set(
      "discordRpc",
      value,
    );

    this.sync();
  }

  get windowState() {
    return (
      store as never as { get(k: string): DesktopConfig["windowState"] }
    ).get("windowState");
  }

  set windowState(value: DesktopConfig["windowState"]) {
    (
      store as never as {
        set(k: string, value: DesktopConfig["windowState"]): void;
      }
    ).set("windowState", value);

    this.sync();
  }
}

export const config = new Config();

ipcMain.on("config", (_, newConfig: Partial<DesktopConfig>) => {
  console.info("Received new configuration", newConfig);
  Object.entries(newConfig).forEach(
    ([key, value]) => (config[key as keyof DesktopConfig] = value as never),
  );
});
