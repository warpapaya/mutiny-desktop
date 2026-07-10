export type StartupConfig = { firstLaunch: boolean };
export const WINDOWS_AUTOSTART_ARG = "--mutiny-autostart";
// auto-launch's supported Linux Desktop Entry mechanism appends this argument
// when `isHidden` is enabled. It also gives us an unambiguous login launch signal.
export const LINUX_AUTOSTART_ARG = "--hidden";

export function linuxAutoLaunchOptions(): { name: string; isHidden: true } {
  return { name: "Mutiny", isHidden: true };
}

export function applyFirstLaunchAutostart(
  config: StartupConfig,
): void {
  if (!config.firstLaunch) return;

  // Previous releases left this flag set for existing installations, including
  // users who had explicitly disabled autostart. Never turn a login item back
  // on implicitly during migration; autostart is controlled only by the user's
  // explicit setting from this point forward.
  config.firstLaunch = false;
}

export function isLoginItemLaunch(
  platform: NodeJS.Platform,
  argv: string[],
  wasOpenedAtLogin: boolean,
): boolean {
  if (platform === "win32") return argv.includes(WINDOWS_AUTOSTART_ARG);
  if (platform === "darwin") return wasOpenedAtLogin;
  if (platform === "linux") return argv.includes(LINUX_AUTOSTART_ARG);
  return false;
}

export function shouldStartMinimised(
  startMinimisedToTray: boolean,
  wasOpenedAtLogin: boolean,
): boolean {
  return startMinimisedToTray && wasOpenedAtLogin;
}

export function shouldRestoreMaximised(
  wasMaximised: boolean,
  startMinimised: boolean,
): boolean {
  return wasMaximised && !startMinimised;
}

export function extractProtocolUrls(argv: string[]): string[] {
  return argv.filter((arg) => {
    try {
      return new URL(arg).protocol === "mutiny:";
    } catch {
      return false;
    }
  });
}

type ProtocolWindow = {
  isDestroyed?: () => boolean;
  webContents: { send(channel: string, url: string): void };
};

export class ProtocolUrlQueue {
  private pending: string[] = [];
  private target?: ProtocolWindow;

  enqueue(url: string): void {
    if (!extractProtocolUrls([url]).length) return;
    if (this.target && !this.target.isDestroyed?.()) {
      this.target.webContents.send("protocol-url", url);
      return;
    }
    this.pending.push(url);
  }

  rendererReady(target: ProtocolWindow): void {
    this.target = target;
    for (const url of this.pending.splice(0)) {
      target.webContents.send("protocol-url", url);
    }
  }
}
