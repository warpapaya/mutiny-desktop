import { NativeImage, app, ipcMain, nativeImage } from "electron";

import { registerBadgeHandler } from "./badgesRegistration";
import { mainWindow } from "./window";

const nativeIcons: Record<number, NativeImage> = {};

function createBadgeIcon(count: number): NativeImage {
  const label = count === -1 ? "•" : String(Math.min(count, 10));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="#d32f2f"/><text x="16" y="21" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="white">${label}</text></svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  );
}

export async function setBadgeCount(count: number): Promise<void> {
  if (!Number.isInteger(count) || count < -1 || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (process.platform === "darwin") {
    app.dock.setBadge(count === -1 ? "•" : count === 0 ? "" : count.toString());
    return;
  }

  if (process.platform === "win32" || process.platform === "linux") {
    if (count === 0) {
      mainWindow.setOverlayIcon(null, "No Notifications");
      return;
    }
    nativeIcons[count] ??= createBadgeIcon(count);
    mainWindow.setOverlayIcon(
      nativeIcons[count],
      count === -1 ? "Unread Messages" : `${count} Notifications`,
    );
  }
}

export function initBadges(): void {
  registerBadgeHandler(ipcMain, setBadgeCount);
}
