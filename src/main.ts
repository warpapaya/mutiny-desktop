import { updateElectronApp } from "update-electron-app";

import { BrowserWindow, app, desktopCapturer, session, shell, systemPreferences } from "electron";
import started from "electron-squirrel-startup";

import { autoLaunch } from "./native/autoLaunch";
import { config } from "./native/config";
import { initDiscordRpc } from "./native/discordRpc";
import { initTray } from "./native/tray";
import { BUILD_URL, createMainWindow, mainWindow } from "./native/window";

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

  // Handle protocol URLs on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('protocol-url', url);
    }
  });

  // Handle protocol URLs on Windows/Linux
  const protocolUrl = process.argv.find(arg => arg.startsWith('mutiny://'));
  if (protocolUrl) {
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.webContents.send('protocol-url', protocolUrl);
      }
    }, 1000);
  }

  // start auto update logic
  updateElectronApp();

  // create and configure the app when electron is ready
  app.on("ready", () => {
    // Grant media permissions for voice chat (microphone, camera, screen share)
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = ["media", "mediaKeySystem", "display-capture", "notifications"];
      callback(allowed.includes(permission));
    });

    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      const allowed = ["media", "mediaKeySystem", "display-capture", "notifications"];
      return allowed.includes(permission);
    });

    // Handle screen sharing requests (required for Electron 17+ on all platforms)
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 150, height: 150 },
        });

        if (sources.length > 0) {
          // Use the entire screen by default (first source is usually "Entire Screen")
          const screen = sources.find(s => s.name === 'Entire Screen') || sources[0];
          callback({ video: screen });
        } else {
          callback({});
        }
      } catch (err) {
        console.error('[mutiny] Error getting desktop capturer sources:', err);
        callback({});
      }
    });

    // Request microphone access on macOS
    if (process.platform === "darwin") {
      systemPreferences.askForMediaAccess("microphone");
      systemPreferences.askForMediaAccess("camera");
      // Also request screen recording permission on macOS
      systemPreferences.getMediaAccessStatus("screen");
    }

    // enable auto start on Windows and MacOS
    if (config.firstLaunch) {
      if (process.platform === "win32" || process.platform === "darwin") {
        autoLaunch.enable();
      }
    }

    // create window and application contexts
    createMainWindow();
    initTray();
    initDiscordRpc();

    // Windows specific fix for notifications
    if (process.platform === "win32") {
      app.setAppUserModelId("gg.mutinyapp.notifications");
    }
  });

  // focus the window if we try to launch again
  app.on("second-instance", () => {
    mainWindow.show();
    mainWindow.restore();
    mainWindow.focus();
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
      createMainWindow();
    } else {
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
