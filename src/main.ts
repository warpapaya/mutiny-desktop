import { updateElectronApp } from "update-electron-app";

import { BrowserWindow, app, dialog, ipcMain, session, shell, systemPreferences } from "electron";
import started from "electron-squirrel-startup";

import "./native/autoLaunch";
import { initBadges } from "./native/badges";
import { config } from "./native/config";
import { initControlServer } from "./native/controlServer";
import { initDiscordRpc } from "./native/discordRpc";
import {
  SCREEN_PERMISSION_SETTINGS_URL,
  createDisplayMediaRequestHandler,
  displayMediaHandlerOptions,
  screenPermissionGuidance,
} from "./native/displayMedia";
import { showScreenPicker } from "./native/screenPicker";
import {
  ProtocolUrlQueue,
  applyFirstLaunchAutostart,
  extractProtocolUrls,
  isLoginItemLaunch,
  shouldStartMinimised,
} from "./native/startup";
import { initTray } from "./native/tray";
import { BUILD_URL, createMainWindow, mainWindow } from "./native/window";
import { registerWindowControlHandlers } from "./native/windowControls";

// Squirrel-specific logic
// create/remove shortcuts on Windows when installing / uninstalling
// we just need to close out of the app immediately
if (started) {
  app.quit();
}

// disable hw-accel if so requested
if (!config.hardwareAcceleration) {
  app.disableHardwareAcceleration();
}

// ensure only one copy of the application can run
const protocolUrls = new ProtocolUrlQueue();
const acquiredLock = app.requestSingleInstanceLock();

if (acquiredLock) {
  // Register protocol handler for mutiny:// deep links
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('mutiny', process.execPath, [process.argv[1]]);
    }
  } else {
    app.setAsDefaultProtocolClient('mutiny');
  }

  // Queue protocol URLs until the hosted renderer has finished loading.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    protocolUrls.enqueue(url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  for (const url of extractProtocolUrls(process.argv)) protocolUrls.enqueue(url);

  // start auto update logic
  updateElectronApp();

  // create and configure the app when electron is ready
  app.on("ready", async () => {
    // Set COOP/COEP headers to enable SharedArrayBuffer for AudioWorklet
    // (required by DeepFilterNet3 noise suppression)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Cross-Origin-Opener-Policy": ["same-origin"],
          "Cross-Origin-Embedder-Policy": ["require-corp"],
          "Content-Security-Policy": [
            "default-src 'self' 'unsafe-inline' data: https://app.mutinyapp.gg https://*.mutinyapp.gg; media-src 'self' blob: data: https:; connect-src 'self' wss: https:;",
          ],
        },
      });
    });

    // Native file picker for audio files (entrance sounds / soundboard)
    ipcMain.handle("dialog:openAudioFile", async () => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          {
            name: "Audio Files",
            extensions: ["mp3", "wav", "ogg", "webm", "opus"],
          },
        ],
      });
      if (result.canceled) return null;
      return result.filePaths[0];
    });

    // Grant media permissions for voice chat (microphone, camera, screen share)
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ["media", "mediaKeySystem", "display-capture", "notifications"];
      callback(allowed.includes(permission));
    });

    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      const allowed = ["media", "mediaKeySystem", "display-capture", "notifications"];
      return allowed.includes(permission);
    });

    // Prefer the native picker on supported macOS versions. Electron falls
    // back to this handler when the native picker is unavailable.
    session.defaultSession.setDisplayMediaRequestHandler(
      createDisplayMediaRequestHandler({
        platform: process.platform,
        getScreenAccessStatus: () =>
          systemPreferences.getMediaAccessStatus("screen"),
        pickSource: showScreenPicker,
        showPermissionGuidance: async (status) => {
          const result = await dialog.showMessageBox(
            mainWindow,
            screenPermissionGuidance(status),
          );
          if (result.response === 0) {
            await shell.openExternal(SCREEN_PERMISSION_SETTINGS_URL);
          }
        },
      }),
      displayMediaHandlerOptions(process.platform),
    );

    // Apply the one-time autostart default before creating the first window.
    try {
      applyFirstLaunchAutostart(config);
    } catch (error) {
      console.error("[mutiny] Failed to apply the autostart default", error);
    }

    const wasOpenedAtLogin = isLoginItemLaunch(
      process.platform,
      process.argv,
      app.getLoginItemSettings().wasOpenedAtLogin,
    );
    const window = createMainWindow({
      startMinimised: shouldStartMinimised(
        config.startMinimisedToTray,
        wasOpenedAtLogin,
      ),
    });
    window.webContents.once("did-finish-load", () =>
      protocolUrls.rendererReady(window),
    );

    registerWindowControlHandlers(ipcMain, () => mainWindow);
    initBadges();
    initTray();
    initDiscordRpc();
    initControlServer();

    // Windows specific fix for notifications
    if (process.platform === "win32") {
      app.setAppUserModelId("gg.mutinyapp.notifications");
    }
  });

  // Focus the current window and deliver protocol argv from a second process.
  app.on("second-instance", (_event, argv) => {
    for (const url of extractProtocolUrls(argv)) protocolUrls.enqueue(url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.restore();
      mainWindow.focus();
    }
  });

  // macOS specific behaviour to keep app active in dock:
  // (irrespective of the minimise-to-tray option)

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createMainWindow();
      window.webContents.once("did-finish-load", () =>
        protocolUrls.rendererReady(window),
      );
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ensure URLs launch in external context
  app.on("web-contents-created", (_, contents) => {
    // prevent navigation out of build URL origin
    contents.on("will-navigate", (event, navigationUrl) => {
      if (new URL(navigationUrl).origin !== BUILD_URL.origin) {
        event.preventDefault();
      }
    });

    // handle links externally
    contents.setWindowOpenHandler(({ url }) => {
      if (
        url.startsWith("http:") ||
        url.startsWith("https:") ||
        url.startsWith("mailto:")
      ) {
        setImmediate(() => {
          shell.openExternal(url);
        });
      }

      return { action: "deny" };
    });
  });
} else {
  app.quit();
}
