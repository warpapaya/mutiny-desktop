import { BrowserWindow, desktopCapturer, ipcMain } from "electron";
import { mainWindow } from "./window";

/**
 * Show a screen/window picker dialog and return the selected source.
 * Returns null if the user cancels.
 */
export async function showScreenPicker(): Promise<Electron.DesktopCapturerSource | null> {
  console.log('[mutiny] showScreenPicker called, fetching sources...');
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: process.platform !== "win32", // fetchWindowIcons is flaky on Windows
  });

  console.log(`[mutiny] desktopCapturer returned ${sources.length} sources:`, sources.map(s => s.name));
  if (sources.length === 0) return null;
  // If only one source (single monitor, no windows), skip picker
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
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    picker.setMenu(null);

    // Build source data for the HTML
    const sourceData = sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
      isScreen: s.id.startsWith("screen:"),
    }));

    const html = buildPickerHTML(sourceData);
    picker.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    let resolved = false;

    // Listen for selection via window.postMessage → webContents
    picker.webContents.on("console-message", (_event, _level, message) => {
      if (resolved) return;
      if (message.startsWith("PICK:")) {
        const sourceId = message.slice(5);
        resolved = true;
        picker.close();
        const selected = sources.find((s) => s.id === sourceId) || null;
        resolve(selected);
      } else if (message === "CANCEL") {
        resolved = true;
        picker.close();
        resolve(null);
      }
    });

    picker.on("closed", () => {
      if (!resolved) resolve(null);
    });
  });
}

interface SourceInfo {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  isScreen: boolean;
}

function buildPickerHTML(sources: SourceInfo[]): string {
  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen);

  return `<!DOCTYPE html>
<html>
<head>
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
    background: #2a2a2a; border: 2px solid transparent; border-radius: 8px;
    padding: 8px; cursor: pointer; transition: all 0.15s;
    display: flex; flex-direction: column; align-items: center;
  }
  .source:hover { background: #333; border-color: #4a9eff; }
  .source img { width: 100%; border-radius: 4px; aspect-ratio: 16/9; object-fit: cover; background: #111; }
  .source .label {
    margin-top: 6px; font-size: 12px; text-align: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    width: 100%; padding: 0 4px;
  }
  .buttons {
    display: flex; justify-content: flex-end; margin-top: 16px;
    -webkit-app-region: no-drag;
  }
  .btn {
    padding: 6px 16px; border-radius: 6px; border: none; cursor: pointer;
    font-size: 13px; font-weight: 500;
  }
  .btn-cancel { background: #333; color: #ccc; }
  .btn-cancel:hover { background: #444; }
</style>
</head>
<body>
  <h2>Share your screen</h2>
  ${screens.length > 0 ? `<h3>Screens</h3><div class="grid">${screens.map(sourceHTML).join("")}</div>` : ""}
  ${windows.length > 0 ? `<h3>Windows</h3><div class="grid">${windows.map(sourceHTML).join("")}</div>` : ""}
  <div class="buttons">
    <button class="btn btn-cancel" onclick="cancel()">Cancel</button>
  </div>
<script>
  function pick(id) { console.log("PICK:" + id); }
  function cancel() { console.log("CANCEL"); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cancel(); });
</script>
</body>
</html>`;
}

function sourceHTML(s: SourceInfo): string {
  const escaped = s.name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<div class="source" onclick="pick('${s.id}')" title="${escaped}">
    <img src="${s.thumbnail}" alt="${escaped}">
    <div class="label">${escaped}</div>
  </div>`;
}
