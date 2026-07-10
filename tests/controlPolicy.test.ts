import { describe, expect, it } from "vitest";

import { authorizeControlRequest } from "../src/native/controlPolicy";

const token = "test-token";

describe("Stream Deck request policy", () => {
  it("keeps ping as a read-only unauthenticated GET", () => {
    expect(authorizeControlRequest({ method: "GET", path: "/ping", headers: {}, token })).toEqual({ allowed: true });
  });

  it("rejects state-changing GET requests", () => {
    expect(authorizeControlRequest({ method: "GET", path: "/disconnect", headers: {}, token })).toMatchObject({ allowed: false, status: 405 });
  });

  it("rejects unauthenticated mutation requests", () => {
    expect(authorizeControlRequest({ method: "POST", path: "/toggle-mute", headers: {}, token })).toMatchObject({ allowed: false, status: 401 });
  });

  it("rejects browser cross-origin mutation even with a token", () => {
    expect(authorizeControlRequest({
      method: "POST",
      path: "/toggle-mute",
      headers: { authorization: `Bearer ${token}`, origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      token,
    })).toMatchObject({ allowed: false, status: 403 });
  });

  it("allows authenticated local non-browser POST requests", () => {
    expect(authorizeControlRequest({
      method: "POST",
      path: "/toggle-mute",
      headers: { authorization: `Bearer ${token}` },
      token,
    })).toEqual({ allowed: true });
  });
});
