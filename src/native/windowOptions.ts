type MainWindowChromeOptions = Pick<
  Electron.BrowserWindowConstructorOptions,
  | "frame"
  | "titleBarStyle"
  | "trafficLightPosition"
  | "minWidth"
  | "minHeight"
>;

export function usesCustomFrame(
  platform: NodeJS.Platform,
  customFrame: boolean,
): boolean {
  return platform !== "darwin" && customFrame;
}

export function mainWindowOptions(
  platform: NodeJS.Platform,
  customFrame: boolean,
): MainWindowChromeOptions {
  const minimumSize = { minWidth: 800, minHeight: 600 };

  if (platform === "darwin") {
    return {
      ...minimumSize,
      frame: true,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    };
  }

  return {
    ...minimumSize,
    frame: !customFrame,
  };
}
