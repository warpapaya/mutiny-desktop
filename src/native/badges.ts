import { NativeImage, app, ipcMain, nativeImage } from "electron";

import { registerBadgeHandler } from "./badgesRegistration";
import { badgePlan, normalizeBadgeCacheKey } from "./badgePolicy";
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

  const plan = badgePlan(process.platform, count);
  if (plan.kind === "dock") {
    app.dock.setBadge(plan.label);
    return;
  }

  if (plan.kind === "app") {
    app.setBadgeCount(plan.count);
    return;
  }

  if (plan.kind === "overlay") {
    if (plan.count === 0) {
      mainWindow.setOverlayIcon(null, "No Notifications");
      return;
    }
    const cacheKey = normalizeBadgeCacheKey(plan.count);
    nativeIcons[cacheKey] ??= createBadgeIcon(cacheKey);
    mainWindow.setOverlayIcon(
      nativeIcons[cacheKey],
      plan.count === -1 ? "Unread Messages" : `${plan.count} Notifications`,
    );
  }
}

export function initBadges(): void {
  registerBadgeHandler(ipcMain, setBadgeCount);
}
