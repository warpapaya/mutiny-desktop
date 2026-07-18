type ScreenAccessStatus = ReturnType<
  Electron.SystemPreferences["getMediaAccessStatus"]
>;

type DisplayMediaCallback = Parameters<
  Electron.Session["setDisplayMediaRequestHandler"]
>[0] extends (request: infer _Request, callback: infer Callback) => void
  ? Callback
  : never;

type DisplayMediaRequest = Parameters<
  NonNullable<Parameters<Electron.Session["setDisplayMediaRequestHandler"]>[0]>
>[0];

interface DisplayMediaDependencies {
  platform: NodeJS.Platform;
  getScreenAccessStatus: () => ScreenAccessStatus;
  pickSource: () => Promise<Electron.DesktopCapturerSource | null>;
  showPermissionGuidance: (status: "denied" | "restricted") => Promise<void>;
  reportError?: (error: unknown) => void;
}

export const SCREEN_PERMISSION_SETTINGS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

export async function openScreenSettingsIfRequested(
  status: "denied" | "restricted",
  response: number,
  openExternal: (url: string) => Promise<void>,
): Promise<void> {
  if (status === "denied" && response === 0) {
    await openExternal(SCREEN_PERMISSION_SETTINGS_URL);
  }
}

export function screenPermissionGuidance(
  status: "denied" | "restricted",
): Electron.MessageBoxOptions {
  if (status === "restricted") {
    return {
      type: "warning",
      title: "Screen Recording Restricted",
      message: "Mutiny cannot share your screen because access is restricted.",
      detail:
        "Screen recording is restricted by a system policy. Contact your administrator to request access.",
      buttons: ["OK"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
  }

  return {
    type: "warning",
    title: "Screen Recording Permission Required",
    message: "Mutiny cannot share your screen without Screen Recording access.",
    detail:
      "Screen recording access is currently denied. Open System Settings → Privacy & Security → Screen Recording, enable Mutiny, then restart Mutiny.",
    buttons: ["Open System Settings", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };
}

export function displayMediaHandlerOptions(
  platform: NodeJS.Platform,
): Electron.DisplayMediaRequestHandlerOpts {
  return { useSystemPicker: platform === "darwin" };
}

export function createDisplayMediaRequestHandler({
  platform,
  getScreenAccessStatus,
  pickSource,
  showPermissionGuidance,
  reportError = (error) => console.error("[mutiny] Screen picker failed", error),
}: DisplayMediaDependencies) {
  return async (_request: DisplayMediaRequest, callback: DisplayMediaCallback) => {
    let completed = false;
    const complete: DisplayMediaCallback = (streams) => {
      if (completed) return;
      completed = true;
      callback(streams);
    };

    try {
      if (platform === "darwin") {
        const status = getScreenAccessStatus();
        if (status === "denied" || status === "restricted") {
          await showPermissionGuidance(status);
          complete({});
          return;
        }
      }

      const selected = await pickSource();
      complete(selected ? { video: selected } : {});
    } catch (error) {
      reportError(error);
      complete({});
    }
  };
}
