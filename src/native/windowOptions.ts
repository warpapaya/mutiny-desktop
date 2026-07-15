type MainWindowChromeOptions = Pick<
  Electron.BrowserWindowConstructorOptions,
  | "frame"
  | "titleBarStyle"
  | "trafficLightPosition"
  | "minWidth"
  | "minHeight"
>;

export function usesCustomFrame(
  _platform: NodeJS.Platform,
  customFrame: boolean,
): boolean {
  return customFrame;
}

export function mainWindowOptions(
  platform: NodeJS.Platform,
  customFrame: boolean,
): MainWindowChromeOptions {
  if (platform === "darwin") {
    return {
      minWidth: 800,
      minHeight: 600,
      frame: true,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    };
  }

  return {
    minWidth: 300,
    minHeight: 300,
    frame: !customFrame,
  };
}
