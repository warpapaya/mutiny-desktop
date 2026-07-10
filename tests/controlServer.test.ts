import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp" },
}));
vi.mock("../src/native/window", () => ({ mainWindow: undefined }));

import { createControlServer } from "../src/native/controlServer";

const token = "test-token";
let server: ReturnType<typeof createControlServer>;
let baseUrl: string;

beforeEach(async () => {
  server = createControlServer(token);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("Stream Deck HTTP server", () => {
  it("keeps ping unauthenticated and side-effect free", async () => {
    const response = await fetch(`${baseUrl}/ping`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, result: "pong" });
  });

  it("rejects drive-by state-changing GET requests", async () => {
    const response = await fetch(`${baseUrl}/disconnect`);
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects unauthenticated state-changing POST requests", async () => {
    const response = await fetch(`${baseUrl}/toggle-mute`, { method: "POST" });
    expect(response.status).toBe(401);
  });

  it("rejects browser-originated POST requests even with the token", async () => {
    const response = await fetch(`${baseUrl}/toggle-mute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://evil.example",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    expect(response.status).toBe(403);
  });

  it("accepts an authenticated origin-less local client request", async () => {
    const response = await fetch(`${baseUrl}/toggle-mute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    // The policy accepted the request; no mocked application window is available.
    expect(response.status).toBe(503);
  });
});
