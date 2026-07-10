/**
 * Authenticated loopback control server for local Stream Deck scripts.
 * GET /ping is read-only. Every state-changing command requires an
 * origin-less POST with the session bearer token stored in the user-data dir.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import * as http from "node:http";
import { join } from "node:path";

import { app } from "electron";

import { authorizeControlRequest } from "./controlPolicy";
import { voiceControlScript, type VoiceControlAction } from "./voiceControl";
import { mainWindow } from "./window";

const PORT = 7423;
const HOST = "127.0.0.1";

const ROUTES: Record<string, VoiceControlAction | "focus" | "ping"> = {
  "/toggle-mute": "toggleMute",
  "/mute": "toggleMute",
  "/toggle-deafen": "toggleDeafen",
  "/deafen": "toggleDeafen",
  "/disconnect": "disconnect",
  "/leave": "disconnect",
  "/focus": "focus",
  "/ping": "ping",
};

function respond(res: http.ServerResponse, status: number, body: object): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function createControlServer(token: string): http.Server {
  return http.createServer(async (req, res) => {
    const remote = req.socket.remoteAddress ?? "";
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
      respond(res, 403, { ok: false, error: "Forbidden" });
      return;
    }

    const path = (req.url ?? "/").split("?")[0];
    const action = ROUTES[path];
    if (!action) {
      respond(res, 404, { ok: false, error: "Unknown command" });
      return;
    }

    const policy = authorizeControlRequest({
      method: req.method,
      path,
      headers: req.headers,
      token,
    });
    if (policy.allowed === false) {
      respond(res, policy.status, { ok: false, error: policy.error });
      return;
    }

    if (action === "ping") {
      respond(res, 200, { ok: true, result: "pong" });
      return;
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
      respond(res, 503, { ok: false, error: "Mutiny window not available" });
      return;
    }

    try {
      let result: string;
      if (action === "focus") {
        mainWindow.show();
        mainWindow.focus();
        result = "focused";
      } else {
        result = await mainWindow.webContents.executeJavaScript(
          voiceControlScript(action),
        );
      }

      if (result === "not-found") {
        respond(res, 409, { ok: false, result });
        return;
      }
      respond(res, 200, { ok: true, result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      respond(res, 500, { ok: false, error: message });
    }
  });
}

export function initControlServer(): void {
  const token = randomBytes(32).toString("hex");
  const tokenPath = join(app.getPath("userData"), "streamdeck-token");
  try {
    writeFileSync(tokenPath, token, { encoding: "utf8", mode: 0o600 });
    if (process.platform !== "win32") chmodSync(tokenPath, 0o600);
  } catch (error) {
    console.error("[mutiny] Control server token provisioning failed; server disabled", error);
    return;
  }

  const server = createControlServer(token);
  server.listen(PORT, HOST, () => {
    console.log(`[mutiny] Stream Deck control server listening on ${HOST}:${PORT}`);
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.warn(`[mutiny] Control server: port ${PORT} already in use — skipping`);
    } else {
      console.error("[mutiny] Control server error:", error);
    }
  });
}
