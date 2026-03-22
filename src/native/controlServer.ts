/**
 * Stream Deck Control Server
 *
 * Tiny HTTP server (127.0.0.1:7423) that accepts commands from Stream Deck
 * PowerShell scripts and forwards them to the Mutiny renderer via executeJavaScript.
 *
 * Endpoints:
 *   GET /ping           — health check, returns "pong"
 *   GET /toggle-mute    — toggle microphone mute
 *   GET /toggle-deafen  — toggle deafen
 *   GET /disconnect     — leave the current voice channel
 *   GET /focus          — bring the Mutiny window to front
 *
 * All endpoints respond with JSON: { ok: true, result: string }
 * Only 127.0.0.1 connections are accepted.
 */

import * as http from "http";

import { mainWindow } from "./window";

const PORT = 7423;
const HOST = "127.0.0.1";

// JS injected into the renderer for each command.
// Uses multiple selector strategies for resilience across Mutiny frontend versions.
const SCRIPTS = {
  toggleMute: `
    (function () {
      // Strategy 1: tooltip title (classic Mutiny)
      const byTitle = document.querySelector(
        'button[title*="Mute microphone"], button[title*="Unmute microphone"]'
      );
      if (byTitle) { byTitle.click(); return 'clicked:title'; }

      // Strategy 2: aria-label
      const byAria = document.querySelector(
        'button[aria-label*="ute microphone"]'
      );
      if (byAria) { byAria.click(); return 'clicked:aria'; }

      // Strategy 3: data-tooltip (newer Mutiny frontend)
      const byTooltip = document.querySelector(
        '[data-tooltip*="ute microphone"]'
      );
      if (byTooltip) { byTooltip.click(); return 'clicked:data-tooltip'; }

      // Strategy 4: find the voice panel and click the first non-disconnect button
      const panel = document.querySelector(
        '[class*="voice" i] .actions, [class*="VoiceHeader"] .actions, [class*="call-controls"]'
      );
      if (panel) {
        const btns = [...panel.querySelectorAll('button')];
        // Disconnect button usually has a phone/hangup icon — skip it
        const micBtn = btns.find(b => !b.querySelector('[class*="phone" i], [class*="hangup" i]'));
        if (micBtn) { micBtn.click(); return 'clicked:panel-button'; }
      }

      return 'not-found';
    })()
  `,

  toggleDeafen: `
    (function () {
      const byTitle = document.querySelector(
        'button[title*="Deafen"], button[title*="Undeafen"]'
      );
      if (byTitle) { byTitle.click(); return 'clicked:title'; }

      const byAria = document.querySelector(
        'button[aria-label*="eafen"]'
      );
      if (byAria) { byAria.click(); return 'clicked:aria'; }

      const byTooltip = document.querySelector('[data-tooltip*="eafen"]');
      if (byTooltip) { byTooltip.click(); return 'clicked:data-tooltip'; }

      return 'not-found';
    })()
  `,

  disconnect: `
    (function () {
      const byTitle = document.querySelector(
        'button[title*="Disconnect"], button[title*="Leave"], button[title*="Hang up"]'
      );
      if (byTitle) { byTitle.click(); return 'clicked:title'; }

      const byAria = document.querySelector(
        'button[aria-label*="isconnect"], button[aria-label*="eave"]'
      );
      if (byAria) { byAria.click(); return 'clicked:aria'; }

      return 'not-found';
    })()
  `,
} as const;

type CommandKey = keyof typeof SCRIPTS;

const ROUTES: Record<string, CommandKey | "focus" | "ping"> = {
  "/toggle-mute": "toggleMute",
  "/mute": "toggleMute",
  "/toggle-deafen": "toggleDeafen",
  "/deafen": "toggleDeafen",
  "/disconnect": "disconnect",
  "/leave": "disconnect",
  "/focus": "focus",
  "/ping": "ping",
};

export function initControlServer(): void {
  const server = http.createServer(async (req, res) => {
    // Reject non-local connections
    const remote = req.socket.remoteAddress ?? "";
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    const path = (req.url ?? "/").split("?")[0];
    const action = ROUTES[path];

    if (!action) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unknown command",
          path,
          available: Object.keys(ROUTES),
        }),
      );
      return;
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Mutiny window not available" }));
      return;
    }

    try {
      let result: string;

      if (action === "ping") {
        result = "pong";
      } else if (action === "focus") {
        mainWindow.show();
        mainWindow.focus();
        result = "focused";
      } else {
        result = await mainWindow.webContents.executeJavaScript(
          SCRIPTS[action],
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, result }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(
      `[mutiny] Stream Deck control server → http://${HOST}:${PORT}`,
    );
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(
        `[mutiny] Control server: port ${PORT} already in use — skipping`,
      );
    } else {
      console.error("[mutiny] Control server error:", err);
    }
  });
}
