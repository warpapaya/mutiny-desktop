import { join } from "node:path";

import { BrowserWindow, desktopCapturer, ipcMain } from "electron";

import { mainWindow } from "./window";
import { registerPickerSession } from "./screenPickerResult";

/**
 * Show the fallback screen/window picker and return the selected source.
 * The native macOS picker bypasses this handler when it is available.
 */
export async function showScreenPicker(): Promise<Electron.DesktopCapturerSource | null> {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: process.platform !== "win32",
  });

  if (sources.length === 0) return null;
  if (sources.length === 1) return sources[0];

  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      width: 680,
      height: 520,
      parent: mainWindow,
      modal: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      frame: false,
      backgroundColor: "#1a1a1a",
      webPreferences: {
        preload: join(__dirname, "pickerPreload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    picker.setMenu(null);

    registerPickerSession(ipcMain, picker, sources, resolve);

    const sourceData = sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
      isScreen: source.id.startsWith("screen:"),
    }));

    void picker
      .loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(buildPickerHTML(sourceData))}`,
      )
      .catch(() => picker.close());
  });
}

interface SourceInfo {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  isScreen: boolean;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sourceHTML(source: SourceInfo): string {
  const id = escapeAttribute(source.id);
  const name = escapeAttribute(source.name);
  return `<button class="source" type="button" data-source-id="${id}" title="${name}">
    <img src="${source.thumbnail}" alt="${name}">
    <span class="label">${name}</span>
  </button>`;
}

function buildPickerHTML(sources: SourceInfo[]): string {
  const screens = sources.filter((source) => source.isScreen);
  const windows = sources.filter((source) => !source.isScreen);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #1a1a1a; color: #e0e0e0;
    padding: 20px; user-select: none;
    -webkit-app-region: drag;
  }
  h2 { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #fff; }
  h3 { font-size: 13px; font-weight: 500; margin: 16px 0 8px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px; -webkit-app-region: no-drag;
  }
  .source {
    background: #2a2a2a; color: inherit; border: 2px solid transparent; border-radius: 8px;
    padding: 8px; cursor: pointer; transition: all 0.15s;
    display: flex; flex-direction: column; align-items: center;
  }
  .source:hover, .source:focus-visible { background: #333; border-color: #4a9eff; outline: none; }
  .source img { width: 100%; border-radius: 4px; aspect-ratio: 16/9; object-fit: cover; background: #111; }
  .source .label {
    margin-top: 6px; font-size: 12px; text-align: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    width: 100%; padding: 0 4px;
  }
  .buttons { display: flex; justify-content: flex-end; margin-top: 16px; -webkit-app-region: no-drag; }
  .btn { padding: 6px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; }
  .btn-cancel { background: #333; color: #ccc; }
  .btn-cancel:hover, .btn-cancel:focus-visible { background: #444; outline: 2px solid #4a9eff; }
</style>
</head>
<body>
  <h2>Share your screen</h2>
  ${screens.length > 0 ? `<h3>Screens</h3><div class="grid">${screens.map(sourceHTML).join("")}</div>` : ""}
  ${windows.length > 0 ? `<h3>Windows</h3><div class="grid">${windows.map(sourceHTML).join("")}</div>` : ""}
  <div class="buttons"><button class="btn btn-cancel" id="cancel" type="button">Cancel</button></div>
<script>
  document.querySelectorAll('[data-source-id]').forEach((element) => {
    element.addEventListener('click', () => window.screenPicker.select(element.dataset.sourceId));
  });
  document.getElementById('cancel').addEventListener('click', () => window.screenPicker.cancel());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') window.screenPicker.cancel();
  });
</script>
</body>
</html>`;
}
